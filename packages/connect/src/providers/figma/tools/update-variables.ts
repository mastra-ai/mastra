// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

const VariableCollectionChangeSchema = z.object({
  action: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  id: z.string().optional(),
  name: z.string().optional(),
  parentVariableCollectionId: z.string().optional(),
  initialModeId: z.string().optional(),
  initialModeIdToParentModeIdMapping: z.record(z.string(), z.string()).optional(),
  hiddenFromPublishing: z.boolean().optional(),
});

const VariableModeChangeSchema = z.object({
  action: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  id: z.string().optional(),
  name: z.string().optional(),
  variableCollectionId: z.string(),
});

const VariableChangeSchema = z.object({
  action: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  id: z.string().optional(),
  name: z.string().optional(),
  variableCollectionId: z.string().optional(),
  resolvedType: z.enum(['BOOLEAN', 'FLOAT', 'STRING', 'COLOR']).optional(),
  description: z.string().optional(),
  hiddenFromPublishing: z.boolean().optional(),
  scopes: z.array(z.string()).optional(),
  codeSyntax: z.record(z.string(), z.string()).optional(),
});

const ColorSchema = z.object({
  r: z.number(),
  g: z.number(),
  b: z.number(),
  a: z.number().optional(),
});

const VariableAliasSchema = z.object({
  type: z.literal('VARIABLE_ALIAS'),
  id: z.string(),
});

const VariableComposedColorSchema = z.union([
  z.object({ color: ColorSchema, opacity: VariableAliasSchema }),
  z.object({ color: VariableAliasSchema, opacity: z.union([z.number(), VariableAliasSchema]) }),
]);

const VariableModeValueSchema = z.object({
  variableId: z.string(),
  modeId: z.string(),
  value: z.union([
    z.boolean(),
    z.number(),
    z.string(),
    VariableComposedColorSchema,
    ColorSchema,
    VariableAliasSchema,
    z.null(),
  ]),
});

export const updateVariablesInputSchema = z
  .object({
    file_key: z.string().describe('File key or branch key. Example: "UzYlOaPNPL2c7zmHCEljOs"'),
    variableCollections: z.array(VariableCollectionChangeSchema).optional(),
    variableModes: z.array(VariableModeChangeSchema).optional(),
    variables: z.array(VariableChangeSchema).optional(),
    variableModeValues: z.array(VariableModeValueSchema).optional(),
  })
  .superRefine((data, ctx) => {
    const hasMutations =
      (data.variableCollections?.length ?? 0) > 0 ||
      (data.variableModes?.length ?? 0) > 0 ||
      (data.variables?.length ?? 0) > 0 ||
      (data.variableModeValues?.length ?? 0) > 0;
    if (!hasMutations) {
      ctx.addIssue({
        code: 'custom',
        message:
          'At least one of variableCollections, variableModes, variables, or variableModeValues must be provided and non-empty.',
      });
    }
  });

export const updateVariablesOutputSchema = z.object({
  status: z.number(),
  error: z.boolean(),
  meta: z
    .object({
      tempIdToRealId: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

export function updateVariablesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_update_variables',
    description: 'Create, update, or delete variables and variable collections in a Figma file',
    inputSchema: updateVariablesInputSchema,
    outputSchema: updateVariablesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateVariablesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://developers.figma.com/docs/rest-api/variables-endpoints/#post-variables-endpoint
        endpoint: `/v1/files/${encodeURIComponent(input.file_key)}/variables`,
        data: {
          ...(input.variableCollections !== undefined && { variableCollections: input.variableCollections }),
          ...(input.variableModes !== undefined && { variableModes: input.variableModes }),
          ...(input.variables !== undefined && { variables: input.variables }),
          ...(input.variableModeValues !== undefined && { variableModeValues: input.variableModeValues }),
        },
        retries: 1,
      };

      const response = await platformProxy.post(config);

      const providerResponse = z
        .object({
          status: z.number(),
          error: z.boolean(),
          meta: z
            .object({
              tempIdToRealId: z.record(z.string(), z.string()).optional(),
            })
            .optional(),
        })
        .parse(response.data);

      return {
        status: providerResponse.status,
        error: providerResponse.error,
        ...(providerResponse.meta !== undefined && { meta: providerResponse.meta }),
      };
    },
  });
}
