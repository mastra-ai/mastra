import { z } from 'zod';

const restApi = z
  .object({
    kind: z.literal('rest_api'),
    version: z.literal(1),
    discoveryModes: z
      .array(z.enum(['openapi', 'observed_json']))
      .min(1)
      .max(2),
    openApiUrl: z.url({ protocol: /^https?$/ }).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.discoveryModes.includes('openapi') !== (value.openApiUrl !== undefined))
      context.addIssue({ code: 'custom', message: 'OpenAPI discovery requires its URL.' });
    if (new Set(value.discoveryModes).size !== value.discoveryModes.length)
      context.addIssue({ code: 'custom', message: 'Discovery modes must be unique.' });
  });
const unsupported = <T extends 'spa' | 'fullstack' | 'graphql'>(kind: T) =>
  z.object({ kind: z.literal(kind), version: z.literal(1), execution: z.literal('unsupported') }).strict();

/** Versioned application selection. Explicit kinds remain unavailable until their executor is installed. */
export const applicationDriverSchema = z.union([
  restApi,
  unsupported('spa'),
  unsupported('fullstack'),
  unsupported('graphql'),
]);
export type ApplicationDriver = z.infer<typeof applicationDriverSchema>;

/** Catalog describes extension requirements; it grants no request authority. */
export const applicationDriverCatalog = {
  rest_api: {
    version: 1,
    supportedDiscoveryModes: ['openapi', 'observed_json'],
    routeShape: 'GET/HEAD canonical HTTP path',
    observationShape: 'bounded JSON collection/detail',
    capabilities: ['read_only_discovery'],
    scopeRequirements: ['approved_origin', 'allowed_path', 'permitted_method', 'request_budget'],
    execution: 'available',
  },
  spa: { version: 1, execution: 'unsupported' },
  fullstack: { version: 1, execution: 'unsupported' },
  graphql: { version: 1, execution: 'unsupported' },
} as const;
