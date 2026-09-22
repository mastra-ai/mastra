// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteAuthFactorInputSchema = z.object({
  user_id: z.string().uuid().describe('User UUID. Example: "a02e344e-4eba-473d-b299-b751cbd1fa2c"'),
  factor_id: z.string().uuid().describe('MFA factor UUID to delete. Example: "b1c2d3e4-f5a6-7890-1234-567890abcdef"'),
});

const ProviderFactorSchema = z.object({
  id: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  status: z.string(),
  factor_type: z.string(),
  friendly_name: z.string().nullable().optional(),
});

export const deleteAuthFactorOutputSchema = z.object({
  success: z.boolean(),
  user_id: z.string(),
  factor_id: z.string(),
  factor_type: z.string().optional(),
  status: z.string().optional(),
  friendly_name: z.string().optional(),
});

export function deleteAuthFactorTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_delete_auth_factor',
    description: 'Delete an MFA factor for a user in Supabase.',
    inputSchema: deleteAuthFactorInputSchema,
    outputSchema: deleteAuthFactorOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteAuthFactorOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfig = connection.connection_config;
      const projectUrl =
        connectionConfig && typeof connectionConfig === 'object' && 'projectUrl' in connectionConfig
          ? connectionConfig['projectUrl']
          : undefined;
      const baseUrlOverride =
        typeof projectUrl === 'string'
          ? projectUrl.startsWith('http')
            ? projectUrl
            : `https://${projectUrl}`
          : undefined;

      // https://supabase.com/docs/reference/api
      const listResponse = await platformProxy.get({
        endpoint: '/auth/v1/admin/users/' + encodeURIComponent(input.user_id) + '/factors',
        retries: 3,
        baseUrlOverride,
      });

      const factors = z.array(ProviderFactorSchema).parse(listResponse.data);
      const factor = factors.find(f => f.id === input.factor_id);

      if (!factor) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'MFA factor not found for user',
          user_id: input.user_id,
          factor_id: input.factor_id,
        });
      }

      // https://supabase.com/docs/reference/api
      await platformProxy.delete({
        endpoint:
          '/auth/v1/admin/users/' +
          encodeURIComponent(input.user_id) +
          '/factors/' +
          encodeURIComponent(input.factor_id),
        retries: 3,
        baseUrlOverride,
      });

      return {
        success: true,
        user_id: input.user_id,
        factor_id: input.factor_id,
        ...(factor.factor_type !== undefined && { factor_type: factor.factor_type }),
        ...(factor.status !== undefined && { status: factor.status }),
        ...(factor.friendly_name != null && { friendly_name: factor.friendly_name }),
      };
    },
  });
}
