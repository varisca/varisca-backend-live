import { Request, Response } from 'express';
import Joi from 'joi';
import pool from '../db';
import { asyncHandler } from '../middleware/errorHandler';
import { sendOtp, verifyOtp, normalizePhone } from '../services/otpService';

const sendOtpSchema = Joi.object({
  phone: Joi.string().trim().required().messages({
    'any.required': 'Phone is required.',
    'string.empty': 'Phone is required.',
  }),
});

const verifyOtpSchema = Joi.object({
  phone: Joi.string().trim().required(),
  otp: Joi.string().trim().pattern(/^\d{6}$/).required().messages({
    'string.pattern.base': 'OTP must be a 6 digit number.',
  }),
});

export const sendOtpController = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = sendOtpSchema.validate(req.body, { abortEarly: false });
  if (error) {
    res.status(400).json({ error: error.details.map((d) => d.message).join('; ') });
    return;
  }

  const result = await sendOtp(value.phone);

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully.',
    data: result,
  });
});

export const verifyOtpController = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = verifyOtpSchema.validate(req.body, { abortEarly: false });
  if (error) {
    res.status(400).json({ error: error.details.map((d) => d.message).join('; ') });
    return;
  }

  const result = await verifyOtp(value.phone, value.otp);

  res.status(200).json({
    success: true,
    message: 'OTP verified successfully.',
    data: result,
  });
});

export const logoutController = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully. Please remove token on client.',
  });
});

export const meController = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT id, email, phone, first_name, last_name, name, created_at
     FROM customers
     WHERE id = $1 AND is_deleted = FALSE
     LIMIT 1`,
    [req.user!.userId],
  );

  if (rows.length === 0) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }

  res.status(200).json({
    success: true,
    data: rows[0],
  });
});

export function normalizePhoneControllerValue(input: string): string {
  return normalizePhone(input);
}
