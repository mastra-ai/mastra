import { z } from 'zod';

export const mastraPackageSchema = z.object({
  name: z.string(),
  version: z.string(),
});

export const systemPackagesResponseSchema = z.object({
  packages: z.array(mastraPackageSchema),
});

export const migrateSpansResponseSchema = z.object({
  success: z.boolean(),
  alreadyMigrated: z.boolean(),
  duplicatesRemoved: z.number(),
  message: z.string(),
});

export type MastraPackage = z.infer<typeof mastraPackageSchema>;
export type SystemPackagesResponse = z.infer<typeof systemPackagesResponseSchema>;
export type MigrateSpansResponse = z.infer<typeof migrateSpansResponseSchema>;
