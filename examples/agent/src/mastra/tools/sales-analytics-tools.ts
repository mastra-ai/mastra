import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Tools with a natural N+1 shape, used to demonstrate Code Mode.
 *
 * A naive agent calling these one-at-a-time would do:
 *   1 call to listRecentOrders, then one getCustomer + one getCustomerLifetimeValue
 *   per order, then sum/average the numbers in its head.
 *
 * With Code Mode, the model writes a single program that batches the per-customer
 * lookups with Promise.all and does the arithmetic in JS — collapsing the whole
 * task into one tool call.
 */

// --- A tiny in-memory dataset so the example is deterministic and offline. ---

interface OrderRecord {
  orderId: string;
  customerId: string;
  total: number;
  placedAt: string;
}

interface CustomerRecord {
  id: string;
  name: string;
  tier: 'free' | 'pro' | 'enterprise';
  country: string;
}

const CUSTOMERS: Record<string, CustomerRecord> = {
  c1: { id: 'c1', name: 'Acme Corp', tier: 'enterprise', country: 'US' },
  c2: { id: 'c2', name: 'Globex', tier: 'pro', country: 'DE' },
  c3: { id: 'c3', name: 'Initech', tier: 'free', country: 'US' },
  c4: { id: 'c4', name: 'Umbrella', tier: 'enterprise', country: 'JP' },
};

// Lifetime value per customer (sum of all historical order totals).
const LIFETIME_VALUE: Record<string, number> = {
  c1: 48250.5,
  c2: 12990.0,
  c3: 430.75,
  c4: 88100.25,
};

const ORDERS: OrderRecord[] = [
  { orderId: 'o-1001', customerId: 'c1', total: 1299.99, placedAt: '2026-05-20' },
  { orderId: 'o-1002', customerId: 'c2', total: 349.0, placedAt: '2026-05-21' },
  { orderId: 'o-1003', customerId: 'c3', total: 19.99, placedAt: '2026-05-22' },
  { orderId: 'o-1004', customerId: 'c1', total: 2499.5, placedAt: '2026-05-23' },
  { orderId: 'o-1005', customerId: 'c4', total: 9999.0, placedAt: '2026-05-24' },
];

export const listRecentOrders = createTool({
  id: 'listRecentOrders',
  description: 'List the most recent orders. Returns order id, customer id, and total.',
  inputSchema: z.object({
    limit: z.number().int().min(1).max(50).describe('How many recent orders to return'),
  }),
  outputSchema: z.object({
    orders: z.array(
      z.object({
        orderId: z.string(),
        customerId: z.string(),
        total: z.number(),
        placedAt: z.string(),
      }),
    ),
  }),
  execute: async ({ limit }) => {
    return { orders: ORDERS.slice(0, limit) };
  },
});

export const getCustomer = createTool({
  id: 'getCustomer',
  description: 'Fetch a customer profile by id.',
  inputSchema: z.object({
    customerId: z.string().describe('The customer id, e.g. "c1"'),
  }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    tier: z.enum(['free', 'pro', 'enterprise']),
    country: z.string(),
  }),
  execute: async ({ customerId }) => {
    const customer = CUSTOMERS[customerId];
    if (!customer) {
      throw new Error(`Unknown customer: ${customerId}`);
    }
    return customer;
  },
});

export const getCustomerLifetimeValue = createTool({
  id: 'getCustomerLifetimeValue',
  description: 'Get the lifetime value (total historical spend) for a customer.',
  inputSchema: z.object({
    customerId: z.string().describe('The customer id, e.g. "c1"'),
  }),
  outputSchema: z.object({
    customerId: z.string(),
    lifetimeValue: z.number(),
  }),
  execute: async ({ customerId }) => {
    const lifetimeValue = LIFETIME_VALUE[customerId];
    if (lifetimeValue === undefined) {
      throw new Error(`Unknown customer: ${customerId}`);
    }
    return { customerId, lifetimeValue };
  },
});

// --- A second domain: inventory. Used to demonstrate scoping a separate Code
// --- Mode tool to a different subset of tools (least privilege per code tool). ---

interface ProductRecord {
  sku: string;
  name: string;
  supplierId: string;
  stock: number;
  reorderPoint: number;
}

interface SupplierRecord {
  id: string;
  name: string;
  leadTimeDays: number;
}

const PRODUCTS: Record<string, ProductRecord> = {
  'sku-widget': { sku: 'sku-widget', name: 'Widget', supplierId: 's1', stock: 3, reorderPoint: 10 },
  'sku-gadget': { sku: 'sku-gadget', name: 'Gadget', supplierId: 's1', stock: 42, reorderPoint: 15 },
  'sku-gizmo': { sku: 'sku-gizmo', name: 'Gizmo', supplierId: 's2', stock: 8, reorderPoint: 20 },
  'sku-doohickey': { sku: 'sku-doohickey', name: 'Doohickey', supplierId: 's2', stock: 100, reorderPoint: 25 },
};

const SUPPLIERS: Record<string, SupplierRecord> = {
  s1: { id: 's1', name: 'Globed Parts Co.', leadTimeDays: 7 },
  s2: { id: 's2', name: 'Initrode Supply', leadTimeDays: 14 },
};

export const listProducts = createTool({
  id: 'listProducts',
  description: 'List all products with their SKU, name, supplier id, current stock, and reorder point.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    products: z.array(
      z.object({
        sku: z.string(),
        name: z.string(),
        supplierId: z.string(),
        stock: z.number(),
        reorderPoint: z.number(),
      }),
    ),
  }),
  execute: async () => {
    return { products: Object.values(PRODUCTS) };
  },
});

export const getSupplier = createTool({
  id: 'getSupplier',
  description: 'Fetch a supplier by id, including its name and lead time in days.',
  inputSchema: z.object({
    supplierId: z.string().describe('The supplier id, e.g. "s1"'),
  }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    leadTimeDays: z.number(),
  }),
  execute: async ({ supplierId }) => {
    const supplier = SUPPLIERS[supplierId];
    if (!supplier) {
      throw new Error(`Unknown supplier: ${supplierId}`);
    }
    return supplier;
  },
});
