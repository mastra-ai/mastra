import { z } from 'zod/v4';

export const modelProviderOptionsSchema = z.record(z.string(), z.record(z.string(), z.json()));
