import axios from 'axios';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { msg91Config, otpConfig } from '../config/env';

interface SendOtpSmsInput {
  phone: string;
  otp: string;
}

export async function sendOtpSms({ phone, otp }: SendOtpSmsInput): Promise<void> {
  if (!msg91Config.authKey || !msg91Config.templateId) {
    throw new AppError('SMS service is not configured.', 503);
  }

  const mobile = phone.replace(/\D/g, '');
  const payload = {
    template_id: msg91Config.templateId,
    authkey: msg91Config.authKey,
    mobile: `${msg91Config.countryCode}${mobile}`,
    otp,
    otp_expiry: otpConfig.otpExpiryMinutes,
    otp_length: otpConfig.otpLength,
    realTimeResponse: 1,
  };

  try {
    const response = await axios.post('https://control.msg91.com/api/v5/otp', payload, {
      timeout: msg91Config.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      logger.error('MSG91 OTP send failed', { status: response.status, body: response.data, phone });
      throw new AppError('Failed to send OTP. Please try again.', 502);
    }
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      throw new AppError('SMS provider timeout. Please retry.', 504);
    }

    if (error instanceof AppError) {
      throw error;
    }

    logger.error('MSG91 OTP send error', { message: error.message, phone });
    throw new AppError('Unable to send OTP right now.', 502);
  }
}
