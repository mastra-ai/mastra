import { z } from 'zod';

export const insuranceProfileSchema = z
  .object({
    id: z.string().min(1),
    version: z.string().min(1),
    categories: z.array(z.string().min(1)),
    terminology: z.record(z.string(), z.string().min(1)),
    rules: z.array(z.object({ id: z.string().min(1), description: z.string().min(1) }).strict()),
  })
  .strict();
export const insuranceProfiles = [
  { id: 'generic', version: '1', categories: [], terminology: {}, rules: [] },
] satisfies z.infer<typeof insuranceProfileSchema>[];
export const defaultInsuranceProfile = 'generic';
