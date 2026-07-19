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

export const observabilityStorageCapabilitiesSchema = z.object({
  metrics: z.boolean(),
  logs: z.boolean(),
});

export const editorSourceSchema = z.enum(['code', 'db']);

export const editorSourceCapabilitiesSchema = z.object({
  source: editorSourceSchema,
  storage: z.enum(['database', 'filesystem', 'source-provider', 'unavailable']),
  provider: z
    .object({
      id: z.string(),
      displayName: z.string(),
    })
    .optional(),
  canSave: z.boolean(),
  canOpenChangeRequest: z.boolean(),
  unavailableReason: z.string().optional(),
});

export const systemPackagesResponseSchema = z.object({
  packages: z.array(mastraPackageSchema),
  isDev: z.boolean(),
  cmsEnabled: z.boolean(),
  /**
   * The editor's configured source, when set. `'code'` swaps Studio's
   * Save/Publish UI for Download JSON + Open PR. `'db'` keeps the standard
   * Save/Publish flow. Omitted when the editor has no explicit source.
   */
  editorSource: editorSourceSchema.optional(),
  editorSourceCapabilities: editorSourceCapabilitiesSchema.optional(),
  observabilityEnabled: z.boolean(),
  storageType: z.string().optional(),
  observabilityStorageType: z.string().optional(),
  observabilityStorageCapabilities: observabilityStorageCapabilitiesSchema.optional(),
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
