// ─── Delhivery — axios client, warehouse API helpers, admin REST routes ───
import axios, { type AxiosInstance, type AxiosResponse, isAxiosError } from 'axios';
import { Router, type Request, type Response, type NextFunction } from 'express';
import Joi from 'joi';
import pool from '../db';
import logger from '../utils/logger';
import { AppError, asyncHandler } from '../middleware/errorHandler';

// ─── Config ─────────────────────────────────────────────────────────

const DEFAULT_CREATE_PATH = '/api/backend/clientwarehouse/create/';
/** Delhivery “Client Warehouse Updation” — override via env if your account uses a different path. */
const DEFAULT_UPDATE_PATH = '/api/backend/clientwarehouse/edit/';

function getBaseUrl(): string {
  const raw = (process.env.DELHIVERY_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!raw) {
    throw new AppError('DELHIVERY_BASE_URL is not configured', 503);
  }
  return raw;
}

function getToken(): string {
  const token = (process.env.DELHIVERY_TOKEN || '').trim();
  if (!token) {
    throw new AppError('DELHIVERY_TOKEN is not configured', 503);
  }
  return token;
}

let _client: AxiosInstance | null = null;

/**
 * Reusable axios instance: base URL + Delhivery auth headers.
 * Lazily created; reads env on first use.
 */
export function getDelhiveryAxios(): AxiosInstance {
  if (_client) return _client;

  _client = axios.create({
    baseURL: getBaseUrl(),
    timeout: 60_000,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Token ${getToken()}`,
    },
    validateStatus: () => true,
  });

  return _client;
}

/** @deprecated Prefer getDelhiveryAxios() — alias for “configured instance” export. */
export const delhiveryAxios = new Proxy({} as AxiosInstance, {
  get(_t, prop: string | symbol) {
    return Reflect.get(getDelhiveryAxios(), prop);
  },
});

// ─── Types ──────────────────────────────────────────────────────────

export interface DelhiveryWarehousePayload {
  name: string;
  phone: string;
  pin: string;
  return_address: string;
  registered_name?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  return_pin?: string;
  return_city?: string;
  return_state?: string;
  return_country?: string;
}

function assertSuccessResponse(res: AxiosResponse): void {
  if (res.status >= 200 && res.status < 300) return;
  throw delhiveryResponseToError(res);
}

function delhiveryResponseToError(res: AxiosResponse): AppError {
  const data = res.data as unknown;
  let message = `Delhivery API error (${res.status})`;

  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (typeof o.detail === 'string') message = o.detail;
    else if (typeof o.message === 'string') message = o.message;
    else if (typeof o.error === 'string') message = o.error;
    else if (Array.isArray(o.non_field_errors) && o.non_field_errors.length)
      message = String(o.non_field_errors[0]);
    else {
      try {
        const compact = JSON.stringify(data);
        if (compact && compact !== '{}') message = `${message}: ${compact.slice(0, 500)}`;
      } catch {
        /* ignore */
      }
    }
  }

  const status =
    res.status >= 400 && res.status < 600 ? res.status : 502;
  return new AppError(message, status);
}

function wrapAxiosError(err: unknown): never {
  if (isAxiosError(err)) {
    if (err.response) {
      throw delhiveryResponseToError(err.response);
    }
    logger.error(`Delhivery network error: ${err.message}`);
    throw new AppError(err.message || 'Delhivery request failed (network)', 503);
  }
  throw err;
}

/**
 * Register a pickup / client warehouse with Delhivery.
 * @see POST {DELHIVERY_BASE_URL}/api/backend/clientwarehouse/create/
 */
export async function createWarehouse(
  payload: DelhiveryWarehousePayload,
): Promise<unknown> {
  const client = getDelhiveryAxios();

  try {
    const path = process.env.DELHIVERY_WAREHOUSE_CREATE_PATH || DEFAULT_CREATE_PATH;
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const res = await client.post(normalized, payload);
    assertSuccessResponse(res);
    return res.data;
  } catch (e) {
    wrapAxiosError(e);
  }
}

/**
 * Update an existing client warehouse on Delhivery (same fields as create; `name` identifies the warehouse).
 */
export async function updateWarehouse(
  payload: DelhiveryWarehousePayload,
): Promise<unknown> {
  const client = getDelhiveryAxios();
  try {
    const path = process.env.DELHIVERY_WAREHOUSE_UPDATE_PATH || DEFAULT_UPDATE_PATH;
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const res = await client.post(normalized, payload);
    assertSuccessResponse(res);
    return res.data;
  } catch (e) {
    wrapAxiosError(e);
  }
}

// ─── HTTP: DB + Delhivery ───────────────────────────────────────────

const warehouseBodySchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  phone: Joi.string().trim().min(5).max(20).required(),
  pin: Joi.string().trim().min(3).max(10).required(),
  return_address: Joi.string().trim().min(1).required(),
  registered_name: Joi.string().allow('').trim().max(255).optional(),
  email: Joi.string().email().allow('').lowercase().trim().optional(),
  address: Joi.string().allow('').trim().optional(),
  city: Joi.string().allow('').trim().max(255).optional(),
  country: Joi.string().allow('').trim().max(100).optional().default('India'),
  return_pin: Joi.string().allow('').trim().max(10).optional(),
  return_city: Joi.string().allow('').trim().max(255).optional(),
  return_state: Joi.string().allow('').trim().max(255).optional(),
  return_country: Joi.string().allow('').trim().max(100).optional().default('India'),
});

const router = Router();

router.get(
  '/warehouses',
  asyncHandler(async (_req: Request, res: Response) => {
    const { rows } = await pool.query(
      `SELECT id, name, registered_name, phone, email, address, city, pin, country,
              return_address, return_pin, return_city, return_state, return_country,
              delhivery_response, created_at, updated_at
       FROM warehouses
       ORDER BY created_at DESC`,
    );
    res.json({ data: rows });
  }),
);

router.post(
  '/warehouses',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = warehouseBodySchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      next(new AppError(error.details.map((d) => d.message).join('; '), 422));
      return;
    }

    const payload: DelhiveryWarehousePayload = {
      name: value.name,
      phone: value.phone,
      pin: value.pin,
      return_address: value.return_address,
      registered_name: value.registered_name || undefined,
      email: value.email || undefined,
      address: value.address || undefined,
      city: value.city || undefined,
      country: value.country || 'India',
      return_pin: value.return_pin || undefined,
      return_city: value.return_city || undefined,
      return_state: value.return_state || undefined,
      return_country: value.return_country || 'India',
    };

    const apiData = await createWarehouse(payload);

    const { rows } = await pool.query(
      `INSERT INTO warehouses (
        name, registered_name, phone, email, address, city, pin, country,
        return_address, return_pin, return_city, return_state, return_country,
        delhivery_response, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,NOW())
      RETURNING *`,
      [
        payload.name,
        payload.registered_name ?? '',
        payload.phone,
        payload.email ?? '',
        payload.address ?? '',
        payload.city ?? '',
        payload.pin,
        payload.country ?? 'India',
        payload.return_address,
        payload.return_pin ?? '',
        payload.return_city ?? '',
        payload.return_state ?? '',
        payload.return_country ?? 'India',
        JSON.stringify(apiData),
      ],
    );

    res.status(201).json({ warehouse: rows[0], delhivery: apiData });
  }),
);

router.put(
  '/warehouses/:id',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = warehouseBodySchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      next(new AppError(error.details.map((d) => d.message).join('; '), 422));
      return;
    }

    const { rows: existingRows } = await pool.query(
      'SELECT * FROM warehouses WHERE id = $1',
      [req.params.id],
    );
    if (existingRows.length === 0) {
      next(new AppError('Warehouse not found', 404));
      return;
    }

    const payload: DelhiveryWarehousePayload = {
      name: value.name,
      phone: value.phone,
      pin: value.pin,
      return_address: value.return_address,
      registered_name: value.registered_name || undefined,
      email: value.email || undefined,
      address: value.address || undefined,
      city: value.city || undefined,
      country: value.country || 'India',
      return_pin: value.return_pin || undefined,
      return_city: value.return_city || undefined,
      return_state: value.return_state || undefined,
      return_country: value.return_country || 'India',
    };

    const apiData = await updateWarehouse(payload);

    const { rows } = await pool.query(
      `UPDATE warehouses SET
        name = $1, registered_name = $2, phone = $3, email = $4, address = $5, city = $6, pin = $7, country = $8,
        return_address = $9, return_pin = $10, return_city = $11, return_state = $12, return_country = $13,
        delhivery_response = $14::jsonb, updated_at = NOW()
      WHERE id = $15
      RETURNING *`,
      [
        payload.name,
        payload.registered_name ?? '',
        payload.phone,
        payload.email ?? '',
        payload.address ?? '',
        payload.city ?? '',
        payload.pin,
        payload.country ?? 'India',
        payload.return_address,
        payload.return_pin ?? '',
        payload.return_city ?? '',
        payload.return_state ?? '',
        payload.return_country ?? 'India',
        JSON.stringify(apiData),
        req.params.id,
      ],
    );

    res.json({ warehouse: rows[0], delhivery: apiData });
  }),
);

export default router;
