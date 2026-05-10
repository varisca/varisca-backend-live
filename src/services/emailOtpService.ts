import bcrypt from 'bcryptjs';
import pool from '../db';
import { AppError } from '../middleware/errorHandler';
import { otpConfig } from '../config/env';
import { generateOtp } from '../utils/generateOtp';
import { signCustomerToken } from '../utils/jwt';
import { sendOtpEmail } from './emailService';

interface SendEmailOtpResult {
  email: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

interface VerifyEmailOtpResult {
  token: string;
  customer: {
    id: string;
    email: string;
    phone: string;
    first_name: string | null;
    last_name: string | null;
    name: string;
    created_at: string;
  };
  isNewCustomer: boolean;
}

export interface SendEmailOtpParams {
  firstName: string;
  lastName: string;
  emailInput: string;
}

export function normalizeEmail(input: string): string {
  const email = String(input || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('Invalid email address.', 400);
  }
  return email;
}

function assertCooldown(lastSentAt: string | Date | null): void {
  if (!lastSentAt) return;
  const elapsed = Math.floor((Date.now() - new Date(lastSentAt).getTime()) / 1000);
  if (elapsed < otpConfig.resendCooldownSeconds) {
    throw new AppError(`Please wait ${otpConfig.resendCooldownSeconds - elapsed}s before requesting OTP again.`, 429);
  }
}

function nextHourlyWindowState(row: {
  email_otp_hour_window_start: string | Date | null;
  email_otp_sends_this_hour: number | null;
}): { windowStartIso: string; sendsInWindow: number } {
  const hourMs = 60 * 60 * 1000;
  const windowStart = row.email_otp_hour_window_start
    ? new Date(row.email_otp_hour_window_start).getTime()
    : null;
  let sendsInWindow = row.email_otp_sends_this_hour ?? 0;

  if (windowStart === null || Date.now() - windowStart >= hourMs) {
    return {
      windowStartIso: new Date().toISOString(),
      sendsInWindow: 1,
    };
  }

  if (sendsInWindow >= otpConfig.maxOtpPerHourByEmail) {
    throw new AppError('OTP request limit reached. Please retry after 1 hour.', 429);
  }

  return {
    windowStartIso: new Date(windowStart).toISOString(),
    sendsInWindow: sendsInWindow + 1,
  };
}

export async function sendEmailOtp(params: SendEmailOtpParams): Promise<SendEmailOtpResult> {
  const email = normalizeEmail(params.emailInput);
  const firstName = String(params.firstName || '').trim();
  const lastName = String(params.lastName || '').trim();
  if (!firstName || !lastName) {
    throw new AppError('First name and last name are required.', 400);
  }
  const name = `${firstName} ${lastName}`.trim();

  const otp = generateOtp(otpConfig.otpLength);
  const otpHash = await bcrypt.hash(otp, 12);
  const expiresAt = new Date(Date.now() + otpConfig.otpExpiryMinutes * 60 * 1000);
  const expiresIso = expiresAt.toISOString();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const sel = await client.query(
        `SELECT id, is_deleted, email_otp_last_sent_at, email_otp_hour_window_start, email_otp_sends_this_hour
         FROM customers WHERE LOWER(email) = LOWER($1) FOR UPDATE`,
        [email],
      );

      if (sel.rowCount && sel.rowCount > 0) {
        const existing = sel.rows[0];
        if (existing.is_deleted) {
          throw new AppError('This account is no longer available.', 403);
        }

        assertCooldown(existing.email_otp_last_sent_at);
        const { windowStartIso, sendsInWindow } = nextHourlyWindowState({
          email_otp_hour_window_start: existing.email_otp_hour_window_start,
          email_otp_sends_this_hour: existing.email_otp_sends_this_hour,
        });

        await client.query(
          `UPDATE customers SET
            name = $1, first_name = $2, last_name = $3,
            email_otp_hash = $4, email_otp_expires_at = $5, email_otp_attempts = 0,
            email_otp_last_sent_at = NOW(), email_otp_hour_window_start = $6::timestamptz, email_otp_sends_this_hour = $7,
            email_otp_pending_is_new_customer = FALSE,
            updated_at = NOW()
          WHERE id = $8`,
          [name, firstName, lastName, otpHash, expiresIso, windowStartIso, sendsInWindow, existing.id],
        );

        await client.query('COMMIT');
        await sendOtpEmail({ email, otp, expiresMinutes: otpConfig.otpExpiryMinutes });

        return {
          email,
          expiresInSeconds: otpConfig.otpExpiryMinutes * 60,
          resendAfterSeconds: otpConfig.resendCooldownSeconds,
        };
      }

      const { windowStartIso, sendsInWindow } = nextHourlyWindowState({
        email_otp_hour_window_start: null,
        email_otp_sends_this_hour: 0,
      });

      try {
        await client.query(
          `INSERT INTO customers (
            name, first_name, last_name, email, phone,
            email_otp_hash, email_otp_expires_at, email_otp_attempts,
            email_otp_last_sent_at, email_otp_hour_window_start, email_otp_sends_this_hour,
            email_otp_pending_is_new_customer
          ) VALUES ($1, $2, $3, LOWER($4), '',
            $5, $6, 0, NOW(), $7::timestamptz, $8, TRUE)`,
          [name, firstName, lastName, email, otpHash, expiresIso, windowStartIso, sendsInWindow],
        );
      } catch (ins: any) {
        await client.query('ROLLBACK');
        if (ins.code === '23505' && attempt === 0) {
          continue;
        }
        throw ins;
      }

      await client.query('COMMIT');
      await sendOtpEmail({ email, otp, expiresMinutes: otpConfig.otpExpiryMinutes });

      return {
        email,
        expiresInSeconds: otpConfig.otpExpiryMinutes * 60,
        resendAfterSeconds: otpConfig.resendCooldownSeconds,
      };
    } catch (e) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw e;
    } finally {
      client.release();
    }
  }

  throw new AppError('Could not start OTP flow. Please try again.', 409);
}

export async function verifyEmailOtp(emailInput: string, otp: string): Promise<VerifyEmailOtpResult> {
  const email = normalizeEmail(emailInput);
  const client = await pool.connect();
  let committed = false;

  try {
    await client.query('BEGIN');

    const otpResult = await client.query(
      `SELECT id, email_otp_hash, email_otp_attempts, email_otp_expires_at, email_otp_pending_is_new_customer,
        email, phone, first_name, last_name, name, created_at
       FROM customers
       WHERE LOWER(email) = LOWER($1) AND is_deleted = FALSE
       FOR UPDATE`,
      [email],
    );

    if (otpResult.rowCount === 0) {
      throw new AppError('No account found for this email. Request an OTP first.', 404);
    }

    const row = otpResult.rows[0];

    if (!row.email_otp_hash) {
      throw new AppError('OTP not found. Request a new OTP.', 404);
    }

    if (new Date(row.email_otp_expires_at).getTime() < Date.now()) {
      throw new AppError('OTP expired. Request a new OTP.', 410);
    }

    if (row.email_otp_attempts >= otpConfig.maxVerifyAttempts) {
      throw new AppError('Maximum OTP attempts reached. Request a new OTP.', 429);
    }

    const isValidOtp = await bcrypt.compare(String(otp || ''), row.email_otp_hash);

    if (!isValidOtp) {
      await client.query(
        `UPDATE customers SET email_otp_attempts = email_otp_attempts + 1, updated_at = NOW() WHERE id = $1`,
        [row.id],
      );
      await client.query('COMMIT');
      committed = true;
      throw new AppError('Invalid OTP.', 401);
    }

    const isNewCustomer = row.email_otp_pending_is_new_customer === true;

    await client.query(
      `UPDATE customers SET
        email_otp_hash = NULL,
        email_otp_expires_at = NULL,
        email_otp_attempts = 0,
        email_otp_pending_is_new_customer = FALSE,
        updated_at = NOW()
       WHERE id = $1`,
      [row.id],
    );

    await client.query('COMMIT');
    committed = true;

    const createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);

    const customer = {
      id: row.id,
      email: row.email,
      phone: row.phone || '',
      first_name: row.first_name,
      last_name: row.last_name,
      name: row.name,
      created_at: createdAt,
    };

    const token = signCustomerToken({
      userId: customer.id,
      role: 'customer',
      email: customer.email,
      phone: customer.phone || '',
    });

    return { token, customer, isNewCustomer };
  } catch (error) {
    if (!committed) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ignore */
      }
    }
    throw error;
  } finally {
    client.release();
  }
}
