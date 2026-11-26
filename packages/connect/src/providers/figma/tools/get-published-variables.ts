// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const VariableResolvedDataTypeSchema = z.enum(['BOOLEAN', 'FLOAT', 'STRING', 'COLOR']).or(z.string());

const PublishedVariableSchema = z.object({
  id: z.string(),
  subscribed_id: z.string(),
  name: z.string(),
  key: z.string(),
  variableCollectionId: z.string(),
  resolvedDataType: VariableResolvedDataTypeSchema,
  updatedAt: z.string(),
});

const PublishedVariableCollectionSchema = z.object({
  id: z.string(),
  subscribed_id: z.string(),
  name: z.string(),
  key: z.string(),
  updatedAt: z.string(),
});

export const getPublishedVariablesInputSchema = z.object({
  file_key: z
    .string()
    .describe('Figma file key to retrieve published variables from. Example: "UzYlOaPNPL2c7zmHCEljOs"'),
});

export const getPublishedVariablesOutputSchema = z.object({
  status: z.number(),
  error: z.boolean(),
  meta: z.object({
    variables: z.record(z.string(), PublishedVariableSchema),
    variableCollections: z.record(z.string(), PublishedVariableCollectionSchema),
  }),
});

export function getPublishedVariablesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_get_published_variables',
    description: 'Retrieve all published variables for a Figma file.',
    inputSchema: getPublishedVariablesInputSchema,
    outputSchema: getPublishedVariablesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPublishedVariablesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://developers.figma.com/docs/rest-api/variables-endpoints/
        endpoint: `/v1/files/${encodeURIComponent(input.file_key)}/variables/published`,
        retries: 3,
      });

      const parsed = getPublishedVariablesOutputSchema.parse(response.data);
      return parsed;
    },
  });
}
