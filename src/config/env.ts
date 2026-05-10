export const otpConfig = {
  otpLength: 6,
  otpExpiryMinutes: 5,
  resendCooldownSeconds: 30,
  maxVerifyAttempts: 5,
  maxOtpPerHourByPhone: 5,
  maxOtpPerHourByEmail: 8,
};

export const msg91Config = {
  authKey: process.env.MSG91_AUTH_KEY || '',
  templateId: process.env.MSG91_TEMPLATE_ID || '',
  senderId: process.env.MSG91_SENDER_ID || 'ECOMRX',
  countryCode: process.env.MSG91_COUNTRY_CODE || '91',
  timeoutMs: Number(process.env.MSG91_TIMEOUT_MS || 6000),
};

export const smtpConfig = {
  host: process.env.SMTP_HOST || '',
  port: Number(process.env.SMTP_PORT || 587),
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.SMTP_FROM || '',
};
