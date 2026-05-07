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

const jsonSchemaRecordSchema = z.record(z.string(), z.unknown());

export const apiSchemaResponseShapeSchema = z.object({
  kind: z.enum(['array', 'record', 'object-property', 'single', 'unknown']),
  listProperty: z.string().optional(),
  paginationProperty: z.string().optional(),
});

export const apiSchemaManifestRouteSchema = z.object({
  method: z.string(),
  path: z.string(),
  responseType: z.string(),
  pathParamSchema: jsonSchemaRecordSchema.optional(),
  queryParamSchema: jsonSchemaRecordSchema.optional(),
  bodySchema: jsonSchemaRecordSchema.optional(),
  responseSchema: jsonSchemaRecordSchema.optional(),
  responseShape: apiSchemaResponseShapeSchema,
});

export const apiSchemaManifestResponseSchema = z.object({
  version: z.literal(1),
  routes: z.array(apiSchemaManifestRouteSchema),
});

export type MastraPackage = z.infer<typeof mastraPackageSchema>;
export type SystemPackagesResponse = z.infer<typeof systemPackagesResponseSchema>;
