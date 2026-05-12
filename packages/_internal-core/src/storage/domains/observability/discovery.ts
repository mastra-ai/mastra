import { z } from 'zod/v4';
import { entityTypeField } from '../shared';

// ============================================================================
// Metric Discovery
// ============================================================================

// --- getMetricNames ---

export const getMetricNamesArgsSchema = z
  .object({
    prefix: z.string().optional().describe('Filter metric names by prefix'),
    limit: z.number().int().min(1).optional().describe('Maximum number of names to return'),
  })
  .describe('Arguments for getting metric names');

export type GetMetricNamesArgs = z.infer<typeof getMetricNamesArgsSchema>;

export const getMetricNamesResponseSchema = z.object({
  names: z.array(z.string()).describe('Distinct metric names'),
});

export type GetMetricNamesResponse = z.infer<typeof getMetricNamesResponseSchema>;

// --- getMetricLabelKeys ---

export const getMetricLabelKeysArgsSchema = z
  .object({
    metricName: z.string().describe('Metric name to get label keys for'),
  })
  .describe('Arguments for getting metric label keys');

export type GetMetricLabelKeysArgs = z.infer<typeof getMetricLabelKeysArgsSchema>;

export const getMetricLabelKeysResponseSchema = z.object({
  keys: z.array(z.string()).describe('Distinct label keys for the metric'),
});

export type GetMetricLabelKeysResponse = z.infer<typeof getMetricLabelKeysResponseSchema>;

// --- getMetricLabelValues ---

export const getMetricLabelValuesArgsSchema = z
  .object({
    metricName: z.string().describe('Metric name'),
    labelKey: z.string().describe('Label key to get values for'),
    prefix: z.string().optional().describe('Filter values by prefix'),
    limit: z.number().int().min(1).optional().describe('Maximum number of values to return'),
  })
  .describe('Arguments for getting label values');

export type GetMetricLabelValuesArgs = z.infer<typeof getMetricLabelValuesArgsSchema>;

export const getMetricLabelValuesResponseSchema = z.object({
  values: z.array(z.string()).describe('Distinct label values'),
});

export type GetMetricLabelValuesResponse = z.infer<typeof getMetricLabelValuesResponseSchema>;

// ============================================================================
// Entity & Environment Discovery
// ============================================================================

// --- getEntityTypes ---

export const getEntityTypesArgsSchema = z.object({}).describe('Arguments for getting entity types');

export type GetEntityTypesArgs = z.infer<typeof getEntityTypesArgsSchema>;

export const getEntityTypesResponseSchema = z.object({
  entityTypes: z.array(entityTypeField).describe('Distinct entity types'),
});

export type GetEntityTypesResponse = z.infer<typeof getEntityTypesResponseSchema>;

// --- getEntityNames ---

// TODO(observability): Extend entity-name discovery with query/prefix and limit support.
// The current UI autocomplete can only refine against a capped result set, which is
// enough for "take the top hit" but not enough for globally-correct shell-style
// completion. A richer discovery contract should support prefix filtering and bounded
// result windows, and may also want a root-only mode for root-entity name UX.
export const getEntityNamesArgsSchema = z
  .object({
    entityType: entityTypeField.optional().describe('Optional entity type filter'),
  })
  .describe('Arguments for getting entity names');

export type GetEntityNamesArgs = z.infer<typeof getEntityNamesArgsSchema>;

export const getEntityNamesResponseSchema = z.object({
  names: z.array(z.string()).describe('Distinct entity names'),
});

export type GetEntityNamesResponse = z.infer<typeof getEntityNamesResponseSchema>;

// --- getServiceNames ---

export const getServiceNamesArgsSchema = z.object({}).describe('Arguments for getting service names');

export type GetServiceNamesArgs = z.infer<typeof getServiceNamesArgsSchema>;

export const getServiceNamesResponseSchema = z.object({
  serviceNames: z.array(z.string()).describe('Distinct service names'),
});

export type GetServiceNamesResponse = z.infer<typeof getServiceNamesResponseSchema>;

// --- getEnvironments ---

export const getEnvironmentsArgsSchema = z.object({}).describe('Arguments for getting environments');

export type GetEnvironmentsArgs = z.infer<typeof getEnvironmentsArgsSchema>;

export const getEnvironmentsResponseSchema = z.object({
  environments: z.array(z.string()).describe('Distinct environments'),
});

export type GetEnvironmentsResponse = z.infer<typeof getEnvironmentsResponseSchema>;

// --- getTags ---

export const getTagsArgsSchema = z
  .object({
    entityType: entityTypeField.optional().describe('Optional entity type filter'),
  })
  .describe('Arguments for getting tags');

export type GetTagsArgs = z.infer<typeof getTagsArgsSchema>;

export const getTagsResponseSchema = z.object({
  tags: z.array(z.string()).describe('Distinct tags'),
});

export type GetTagsResponse = z.infer<typeof getTagsResponseSchema>;
