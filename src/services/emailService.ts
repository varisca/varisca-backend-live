import nodemailer from 'nodemailer';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { smtpConfig } from '../config/env';

function getTransport() {
  if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass || !smtpConfig.from) {
    throw new AppError('Email service is not configured.', 503);
  }

  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.port === 465,
    auth: { user: smtpConfig.user, pass: smtpConfig.pass },
  });
}

export async function sendOtpEmail(input: { email: string; otp: string; expiresMinutes: number }) {
  const transport = getTransport();

  const subject = 'Your Varisca login code';
  const text = `Your Varisca OTP is ${input.otp}. It expires in ${input.expiresMinutes} minutes.`;

  try {
    await transport.sendMail({
      from: smtpConfig.from,
      to: input.email,
      subject,
      text,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5">
          <h2 style="margin: 0 0 12px 0;">Varisca login code</h2>
          <p style="margin: 0 0 12px 0;">Use this OTP to sign in:</p>
          <div style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 12px 0;">
            ${input.otp}
          </div>
          <p style="margin: 0; color: #555;">This code expires in ${input.expiresMinutes} minutes.</p>
        </div>
      `,
    });
  } catch (error: any) {
    logger.error('Email OTP send failed', { message: error?.message, email: input.email });
    throw new AppError('Failed to send OTP email. Please try again.', 502);
  }
}

