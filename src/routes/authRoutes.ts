import { Router } from 'express';
import {
  sendOtpController,
  verifyOtpController,
  logoutController,
} from '../controllers/authController';
import { customerAuthMiddleware } from '../middleware/auth';
import { sendOtpIpLimiter, verifyOtpIpLimiter } from '../middleware/rateLimitMiddleware';

const router = Router();

router.post('/send-otp', sendOtpIpLimiter, sendOtpController);
router.post('/verify-otp', verifyOtpIpLimiter, verifyOtpController);
router.post('/logout', customerAuthMiddleware, logoutController);

export default router;
