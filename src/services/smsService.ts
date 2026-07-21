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
  const countryCode = msg91Config.countryCode || '91';
  const formattedMobile = mobile.startsWith(countryCode) ? mobile : `${countryCode}${mobile}`;

  const url = `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(msg91Config.templateId)}&mobile=${encodeURIComponent(formattedMobile)}&authkey=${encodeURIComponent(msg91Config.authKey)}`;

  const payload = {
    template_id: msg91Config.templateId,
    authkey: msg91Config.authKey,
    mobile: formattedMobile,
    otp,
    otp_expiry: otpConfig.otpExpiryMinutes,
    otp_length: otpConfig.otpLength,
    realTimeResponse: 0,
  };

  try {
    const response = await axios.post(url, payload, {
      timeout: msg91Config.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        authkey: msg91Config.authKey,
      },
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300 || response.data?.type === 'error') {
      logger.error('MSG91 OTP send failed', { status: response.status, body: response.data, phone });
      const errMsg = typeof response.data?.message === 'string' ? response.data.message : 'Failed to send OTP. Please try again.';
      throw new AppError(errMsg, 502);
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
