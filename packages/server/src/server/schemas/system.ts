import { z } from 'zod/v4';

export const mastraPackageSchema = z.object({
  name: z.string(),
  version: z.string(),
});

export const observabilityRuntimeStrategySchema = z.enum([
  'realtime',
  'batch-with-updates',
  'insert-only',
  'event-sourced',
]);

export const systemPackagesResponseSchema = z.object({
  packages: z.array(mastraPackageSchema),
  isDev: z.boolean(),
  cmsEnabled: z.boolean(),
  observabilityEnabled: z.boolean(),
  storageType: z.string().optional(),
  observabilityStorageType: z.string().optional(),
  observabilityRuntimeStrategy: observabilityRuntimeStrategySchema.optional(),
});

export type MastraPackage = z.infer<typeof mastraPackageSchema>;
export type SystemPackagesResponse = z.infer<typeof systemPackagesResponseSchema>;
