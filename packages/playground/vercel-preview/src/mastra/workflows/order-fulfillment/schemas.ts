import { z } from 'zod/v4';

export const orderItemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  quantity: z.number().int().min(1).max(10),
});

export const orderInputSchema = z.object({
  customer: z.string().trim().min(1).max(80).default('Studio team'),
  approval: z.enum(['automatic', 'manual']).default('manual').describe('Manual pauses for your approval.'),
  failDispatch: z.boolean().default(false).describe('Enable to test a dispatch error after packing.'),
  items: z
    .array(orderItemSchema)
    .min(1)
    .max(6)
    .default([
      { name: 'Notebook', quantity: 2 },
      { name: 'Desk lamp', quantity: 1 },
      { name: 'Cable kit', quantity: 3 },
    ]),
});

export const checkedOrderSchema = orderInputSchema.extend({
  totalUnits: z.number().int().positive(),
  inventory: z.literal('available'),
  risk: z.literal('low'),
});

export const approvedOrderSchema = checkedOrderSchema.extend({ approvedBy: z.string() });
export const packedItemSchema = orderItemSchema.extend({ label: z.string(), quality: z.literal('passed') });
export const packedOrderSchema = approvedOrderSchema.extend({ packages: z.array(packedItemSchema) });
export const dispatchedOrderSchema = packedOrderSchema.extend({ tracking: z.string() });
