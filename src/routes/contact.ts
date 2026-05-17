import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { sendContactEmail } from '../services/emailService';

const router = Router();

const contactSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  email: Joi.string().trim().email().max(254).required(),
  subject: Joi.string().trim().min(1).max(160).required(),
  message: Joi.string().trim().min(1).max(4000).required(),
});

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = contactSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      throw new AppError(error.details.map((detail) => detail.message).join('; '), 422);
    }

    await sendContactEmail(value);
    res.json({ success: true });
  }),
);

export default router;
