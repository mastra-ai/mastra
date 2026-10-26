import { z } from 'zod';

export const reviewConfigSchema = z.strictObject({ expiryDays: z.number().int().min(1).max(365) });
export const reviewConfig = reviewConfigSchema.parse({ expiryDays: 7 });
export type ReviewConfig = z.infer<typeof reviewConfigSchema>;
