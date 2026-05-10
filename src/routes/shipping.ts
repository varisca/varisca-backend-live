// ─── Shipping Routes ────────────────────────────────────────────────
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { createCrudRouter } from './crud-factory';
import delhiveryRoutes from './delhivery';

const router = Router();

// Delhivery client warehouses (admin JWT) — also available at /api/delhivery/*
router.use('/delhivery', authMiddleware, delhiveryRoutes);

// Delivery Zones
router.use('/zones', createCrudRouter({
  table: 'delivery_zones',
  searchFields: ['name', 'state'],
  defaultSort: 'created_at',
  insertFields: ['name', 'pin_codes_from', 'pin_codes_to', 'state', 'delivery_days', 'is_active'],
  updateFields: ['name', 'pin_codes_from', 'pin_codes_to', 'state', 'delivery_days', 'is_active'],
}));

// Shipping Charges
router.use('/charges', createCrudRouter({
  table: 'shipping_charges',
  searchFields: ['zone'],
  defaultSort: 'created_at',
  insertFields: ['zone', 'min_weight', 'max_weight', 'base_cost', 'per_kg_cost', 'free_above', 'is_active'],
  updateFields: ['zone', 'min_weight', 'max_weight', 'base_cost', 'per_kg_cost', 'free_above', 'is_active'],
}));

// Delivery Partners
router.use('/partners', createCrudRouter({
  table: 'delivery_partners',
  searchFields: ['name', 'code'],
  defaultSort: 'created_at',
  insertFields: ['name', 'code', 'phone', 'email', 'zones', 'is_active', 'total_deliveries', 'rating'],
  updateFields: ['name', 'code', 'phone', 'email', 'zones', 'is_active', 'total_deliveries', 'rating'],
}));

export default router;
