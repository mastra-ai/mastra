// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getLocalVariablesInputSchema = z.object({
  file_key: z.string().describe('The key of the Figma file. Example: "UzYlOaPNPL2c7zmHCEljOs"'),
});

const ModeSchema = z
  .object({
    name: z.string(),
    modeId: z.string(),
  })
  .passthrough();

const VariableCollectionSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    hiddenFromPublishing: z.boolean().optional(),
    key: z.string().optional(),
    defaultModeId: z.string().optional(),
    modes: z.array(ModeSchema).optional(),
    remote: z.boolean().optional(),
    variableIds: z.array(z.string()).optional(),
    localVariableIds: z.array(z.string()).optional(),
  })
  .passthrough();

const VariableSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    variableCollectionId: z.string().optional(),
    key: z.string().optional(),
    remote: z.boolean().optional(),
    resolvedType: z.string().optional(),
    valuesByMode: z.record(z.string(), z.unknown()).optional(),
    scopes: z.array(z.string()).optional(),
    hiddenFromPublishing: z.boolean().optional(),
    codeSyntax: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const getLocalVariablesOutputSchema = z
  .object({
    status: z.number(),
    error: z.boolean(),
    meta: z.object({
      variableCollections: z.record(z.string(), VariableCollectionSchema),
      variables: z.record(z.string(), VariableSchema),
    }),
  })
  .passthrough();

export function getLocalVariablesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_get_local_variables',
    description: 'Retrieve all local variables defined in a Figma file.',
    inputSchema: getLocalVariablesInputSchema,
    outputSchema: getLocalVariablesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getLocalVariablesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://www.figma.com/developers/api#get-local-variables-endpoint
      const response = await platformProxy.get({
        endpoint: `/v1/files/${encodeURIComponent(input.file_key)}/variables/local`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'No data returned for local variables.',
        });
      }

      const data = getLocalVariablesOutputSchema.parse(response.data);

      return data;
    },
  });
}
