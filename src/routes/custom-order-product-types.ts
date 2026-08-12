import { Router, Request, Response } from 'express';
import Joi from 'joi';
import pool from '../db';
import logger from '../utils/logger';

const router = Router();

const typeSchema = Joi.object({
  name: Joi.string().trim().min(1).max(160).required(),
  slug: Joi.string().trim().max(120).allow('').optional(),
  image: Joi.string().trim().allow('').optional(),
  base_price: Joi.number().min(0).required(),
  original_price: Joi.number().min(0).required(),
  sort_order: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional(),
});

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function rowToApi(row: any) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    image: row.image || '',
    base_price: Number(row.base_price),
    original_price: Number(row.original_price),
    sort_order: Number(row.sort_order || 0),
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM custom_order_product_types
       WHERE is_active = TRUE
       ORDER BY sort_order ASC, name ASC`
    );
    res.json({ data: rows.map(rowToApi) });
  } catch (err: any) {
    logger.error(`List custom order product types failed: ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

router.get('/admin', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM custom_order_product_types
       ORDER BY sort_order ASC, name ASC`
    );
    res.json({ data: rows.map(rowToApi) });
  } catch (err: any) {
    logger.error(`List admin custom order product types failed: ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  const { error, value } = typeSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    res.status(400).json({ error: error.details.map((d) => d.message).join('; ') });
    return;
  }

  const slug = slugify(value.slug || value.name);
  if (!slug) {
    res.status(400).json({ error: 'Slug is required' });
    return;
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO custom_order_product_types
        (slug, name, image, base_price, original_price, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        slug,
        value.name,
        value.image || '',
        value.base_price,
        value.original_price,
        value.sort_order ?? 0,
        value.is_active ?? true,
      ]
    );
    res.status(201).json(rowToApi(rows[0]));
  } catch (err: any) {
    const status = err.code === '23505' ? 409 : 500;
    logger.error(`Create custom order product type failed: ${err.message}`, { stack: err.stack });
    res.status(status).json({ error: status === 409 ? 'Product type slug already exists.' : 'An internal error occurred' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  const { error, value } = typeSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    res.status(400).json({ error: error.details.map((d) => d.message).join('; ') });
    return;
  }

  const slug = slugify(value.slug || value.name);
  if (!slug) {
    res.status(400).json({ error: 'Slug is required' });
    return;
  }

  try {
    const { rows } = await pool.query(
      `UPDATE custom_order_product_types
       SET slug = $1, name = $2, image = $3, base_price = $4, original_price = $5,
           sort_order = $6, is_active = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        slug,
        value.name,
        value.image || '',
        value.base_price,
        value.original_price,
        value.sort_order ?? 0,
        value.is_active ?? true,
        req.params.id,
      ]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(rowToApi(rows[0]));
  } catch (err: any) {
    const status = err.code === '23505' ? 409 : 500;
    logger.error(`Update custom order product type failed: ${err.message}`, { stack: err.stack });
    res.status(status).json({ error: status === 409 ? 'Product type slug already exists.' : 'An internal error occurred' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM custom_order_product_types WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    logger.error(`Delete custom order product type failed: ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

export default router;
