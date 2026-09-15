// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listCatalogTypesInputSchema = z.object({}).passthrough();

const ProviderResponseSchema = z
  .object({
    catalog_types: z.array(
      z
        .object({
          annotations: z.record(z.string(), z.string()),
          categories: z.array(
            z.enum(['customer', 'issue-tracker', 'product-feature', 'service', 'on-call', 'team', 'user']),
          ),
          color: z.enum(['yellow', 'green', 'blue', 'violet', 'pink', 'cyan', 'orange']),
          created_at: z.string(),
          description: z.string(),
          dynamic_resource_parameter: z.string().optional(),
          engine_resource_type: z.string(),
          estimated_count: z.number().int().optional(),
          icon: z.enum([
            'alert',
            'bolt',
            'box',
            'briefcase',
            'browser',
            'bulb',
            'calendar',
            'clock',
            'cog',
            'components',
            'database',
            'doc',
            'email',
            'escalation-path',
            'files',
            'flag',
            'folder',
            'globe',
            'incident-template',
            'money',
            'server',
            'severity',
            'status-page',
            'store',
            'star',
            'tag',
            'user',
            'users',
          ]),
          id: z.string(),
          is_editable: z.boolean(),
          is_team_type: z.boolean().optional(),
          last_synced_at: z.string().optional(),
          name: z.string(),
          owning_team_ids: z.array(z.string()).optional(),
          ranked: z.boolean(),
          registry_type: z.string().optional(),
          required_integrations: z.array(z.string()).optional(),
          schema: z
            .object({
              attributes: z.array(
                z
                  .object({
                    array: z.boolean(),
                    backlink_attribute: z.string().optional(),
                    id: z.string(),
                    mode: z.enum(['', 'api', 'dashboard', 'external', 'internal', 'dynamic', 'backlink', 'path']),
                    name: z.string(),
                    path: z
                      .array(z.object({ attribute_id: z.string(), attribute_name: z.string() }).passthrough())
                      .optional(),
                    type: z.string(),
                  })
                  .passthrough(),
              ),
              version: z.number().int(),
            })
            .passthrough(),
          source_repo_url: z.string().optional(),
          type_name: z.string(),
          updated_at: z.string(),
          use_name_as_identifier: z.boolean(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const listCatalogTypesOutputSchema = ProviderResponseSchema;

export function listCatalogTypesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_catalog_types',
    description: 'List catalog types in incident.io.',
    inputSchema: listCatalogTypesInputSchema,
    outputSchema: listCatalogTypesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listCatalogTypesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v3/catalog_types`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
