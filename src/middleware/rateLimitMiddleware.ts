import rateLimit from 'express-rate-limit';

export const sendOtpIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP requests from this IP. Try again in 1 hour.' },
});

export const verifyOtpIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP verification requests from this IP. Try again later.' },
});
