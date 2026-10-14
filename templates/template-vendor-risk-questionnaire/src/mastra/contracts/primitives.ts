import { z } from 'zod';

export const id = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
export const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const text = z.string().max(2_000_000);
export const coordinate = z.string().regex(/^[A-Z]{1,3}[1-9][0-9]{0,6}$/);
export const sourceBinding = { sourceId: id, sourceSha256: hash };
