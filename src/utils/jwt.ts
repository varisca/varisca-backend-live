import jwt, { type SignOptions, type Secret } from 'jsonwebtoken';

export interface CustomerJwtPayload {
  userId: string;
  role: 'customer';
  email: string;
  phone: string;
}

const JWT_SECRET: Secret = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
})();

export function signCustomerToken(payload: CustomerJwtPayload): string {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
    issuer: process.env.JWT_ISSUER || 'varisca-api',
    audience: process.env.JWT_AUDIENCE || 'varisca-customers',
  };

  return jwt.sign(payload, JWT_SECRET, options);
}
