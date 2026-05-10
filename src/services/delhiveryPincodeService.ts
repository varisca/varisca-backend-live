import { getDelhiveryAxios } from '../routes/delhivery';
import logger from '../utils/logger';

/** Digits-only pincode, max 10 chars (India = 6). */
export function normalizePincodeDigits(input: string): string {
  return String(input || '').replace(/\D/g, '').slice(0, 10);
}

/**
 * Delhivery pin serviceability: GET /c/api/pin-codes/json/?filter_codes=...
 * Empty array / empty delivery_codes → not serviceable.
 */
export async function isPincodeServiceable(pincodeRaw: string): Promise<boolean> {
  const pincode = normalizePincodeDigits(pincodeRaw);
  if (pincode.length < 6) {
    return false;
  }

  const client = getDelhiveryAxios();
  const path = `/c/api/pin-codes/json/?filter_codes=${encodeURIComponent(pincode)}`;
  const res = await client.get(path);

  if (res.status === 401 || res.status === 403) {
    logger.warn(`Delhivery pincode API auth failed: ${res.status}`);
    throw new Error('Delivery pincode check is not available (authentication failed).');
  }

  if (res.status < 200 || res.status >= 300) {
    logger.warn(`Delhivery pincode API HTTP ${res.status}`, { data: res.data });
    throw new Error('Could not verify pincode. Please try again in a moment.');
  }

  const data = res.data;

  if (Array.isArray(data)) {
    return data.length > 0;
  }

  if (data && typeof data === 'object' && Array.isArray((data as { delivery_codes?: unknown }).delivery_codes)) {
    return ((data as { delivery_codes: unknown[] }).delivery_codes).length > 0;
  }

  return false;
}
