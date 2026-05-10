import bcrypt from 'bcryptjs';
import pool from '../db';
import { AppError } from '../middleware/errorHandler';
import { otpConfig } from '../config/env';
import { generateOtp } from '../utils/generateOtp';
import { sendOtpSms } from './smsService';
import { signCustomerToken } from '../utils/jwt';

interface SendOtpResult {
  phone: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

interface VerifyOtpResult {
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

export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  const normalized = digits.length === 10 ? `91${digits}` : digits;

  if (!/^\d{10,15}$/.test(normalized)) {
    throw new AppError('Invalid mobile number format.', 400);
  }

  return normalized;
}

async function assertPhoneRequestLimits(phone: string): Promise<void> {
  const perPhone = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM otp_requests
     WHERE phone = $1 AND created_at >= NOW() - INTERVAL '1 hour'`,
    [phone],
  );

  if (perPhone.rows[0].count >= otpConfig.maxOtpPerHourByPhone) {
    throw new AppError('OTP request limit reached. Please retry after 1 hour.', 429);
  }
}

async function assertResendCooldown(phone: string): Promise<void> {
  const latest = await pool.query(
    `SELECT created_at
     FROM otp_requests
     WHERE phone = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone],
  );

  if (latest.rowCount === 0) {
    return;
  }

  const createdAt = new Date(latest.rows[0].created_at).getTime();
  const elapsed = Math.floor((Date.now() - createdAt) / 1000);

  if (elapsed < otpConfig.resendCooldownSeconds) {
    throw new AppError(`Please wait ${otpConfig.resendCooldownSeconds - elapsed}s before requesting OTP again.`, 429);
  }
}

export async function sendOtp(phoneInput: string): Promise<SendOtpResult> {
  const phone = normalizePhone(phoneInput);

  await assertResendCooldown(phone);
  await assertPhoneRequestLimits(phone);

  const otp = generateOtp(otpConfig.otpLength);
  const otpHash = await bcrypt.hash(otp, 12);

  const expiresAt = new Date(Date.now() + otpConfig.otpExpiryMinutes * 60 * 1000);

  await pool.query(
    `INSERT INTO otp_requests (phone, otp_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [phone, otpHash, expiresAt.toISOString()],
  );

  await sendOtpSms({ phone, otp });

  return {
    phone,
    expiresInSeconds: otpConfig.otpExpiryMinutes * 60,
    resendAfterSeconds: otpConfig.resendCooldownSeconds,
  };
}

export async function verifyOtp(phoneInput: string, otp: string): Promise<VerifyOtpResult> {
  const phone = normalizePhone(phoneInput);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const otpResult = await client.query(
      `SELECT id, otp_hash, attempts, consumed, expires_at
       FROM otp_requests
       WHERE phone = $1
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [phone],
    );

    if (otpResult.rowCount === 0) {
      throw new AppError('OTP not found. Request a new OTP.', 404);
    }

    const otpRow = otpResult.rows[0];

    if (otpRow.consumed) {
      throw new AppError('OTP already used. Request a new OTP.', 409);
    }

    if (new Date(otpRow.expires_at).getTime() < Date.now()) {
      throw new AppError('OTP expired. Request a new OTP.', 410);
    }

    if (otpRow.attempts >= otpConfig.maxVerifyAttempts) {
      throw new AppError('Maximum OTP attempts reached. Request a new OTP.', 429);
    }

    const isValidOtp = await bcrypt.compare(otp, otpRow.otp_hash);

    if (!isValidOtp) {
      await client.query(
        `UPDATE otp_requests
         SET attempts = attempts + 1
         WHERE id = $1`,
        [otpRow.id],
      );
      throw new AppError('Invalid OTP.', 401);
    }

    await client.query(
      `UPDATE otp_requests
       SET consumed = TRUE, consumed_at = NOW()
       WHERE id = $1`,
      [otpRow.id],
    );

    let customerRes = await client.query(
      `SELECT id, email, phone, first_name, last_name, name, created_at
       FROM customers
       WHERE phone = $1 AND is_deleted = FALSE
       LIMIT 1`,
      [phone],
    );

    let isNewCustomer = false;

    if (customerRes.rowCount === 0) {
      isNewCustomer = true;
      const syntheticEmail = `phone_${phone}@otp.local`;
      customerRes = await client.query(
        `INSERT INTO customers (name, first_name, last_name, email, phone)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, phone, first_name, last_name, name, created_at`,
        ['OTP Customer', null, null, syntheticEmail, phone],
      );
    }

    await client.query('COMMIT');

    const customer = customerRes.rows[0];
    const token = signCustomerToken({
      userId: customer.id,
      role: 'customer',
      email: customer.email,
      phone: customer.phone,
    });

    return {
      token,
      customer,
      isNewCustomer,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function purgeExpiredOtps(): Promise<number> {
  const result = await pool.query(
    `DELETE FROM otp_requests
     WHERE expires_at < NOW() - INTERVAL '1 day'
       OR (consumed = TRUE AND consumed_at < NOW() - INTERVAL '1 day')`,
  );

  return result.rowCount || 0;
}
