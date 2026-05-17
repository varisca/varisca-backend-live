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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

export async function sendContactEmail(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  const transport = getTransport();
  const subject = `Varisca contact: ${input.subject}`;
  const text = [
    'New contact form message',
    '',
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Subject: ${input.subject}`,
    '',
    input.message,
  ].join('\n');

  try {
    await transport.sendMail({
      from: smtpConfig.from,
      to: 'varisca.team@gmail.com',
      replyTo: input.email,
      subject,
      text,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5">
          <h2 style="margin: 0 0 12px 0;">New contact form message</h2>
          <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${escapeHtml(input.name)}</p>
          <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${escapeHtml(input.email)}</p>
          <p style="margin: 0 0 16px 0;"><strong>Subject:</strong> ${escapeHtml(input.subject)}</p>
          <div style="white-space: pre-wrap; border-top: 1px solid #eee; padding-top: 16px;">${escapeHtml(input.message)}</div>
        </div>
      `,
    });
  } catch (error: any) {
    logger.error('Contact email send failed', { message: error?.message, email: input.email });
    throw new AppError('Failed to send message. Please try again or email varisca.team@gmail.com directly.', 502);
  }
}

