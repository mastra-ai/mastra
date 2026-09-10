// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listAuthFactorsInputSchema = z.object({
  user_id: z
    .string()
    .uuid()
    .describe(
      'The UUID of the Supabase Auth user whose MFA factors to list. Example: "a02e344e-4eba-473d-b299-b751cbd1fa2c"',
    ),
});

const ProviderFactorSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  friendly_name: z.string().nullable().optional(),
  factor_type: z.enum(['totp', 'phone']).optional(),
  status: z.enum(['verified', 'unverified']).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

const FactorSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  friendly_name: z.string().optional(),
  factor_type: z.enum(['totp', 'phone']).optional(),
  status: z.enum(['verified', 'unverified']).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const listAuthFactorsOutputSchema = z.object({
  factors: z.array(FactorSchema),
});

export function listAuthFactorsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_list_auth_factors',
    description: 'List MFA factors enrolled for a specific user in Supabase.',
    inputSchema: listAuthFactorsInputSchema,
    outputSchema: listAuthFactorsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listAuthFactorsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfig = connection.connection_config;
      let projectUrl: string | undefined;
      if (typeof connectionConfig === 'object' && connectionConfig !== null && 'projectUrl' in connectionConfig) {
        const maybeUrl = connectionConfig['projectUrl'];
        if (typeof maybeUrl === 'string') {
          projectUrl = maybeUrl;
        }
      }
      const baseUrlOverride = projectUrl
        ? projectUrl.startsWith('http')
          ? projectUrl
          : `https://${projectUrl}`
        : undefined;

      // https://supabase.com/docs/reference/api/admin-list-user-factors
      const response = await platformProxy.get({
        endpoint: `/auth/v1/admin/users/${encodeURIComponent(input.user_id)}/factors`,
        baseUrlOverride,
        retries: 3,
      });

      const rawFactors = Array.isArray(response.data) ? response.data : [];
      const factors = rawFactors.map(item => {
        const parsed = ProviderFactorSchema.safeParse(item);
        if (!parsed.success) {
          return null;
        }
        const factor = parsed.data;
        return {
          id: factor.id,
          user_id: factor.user_id,
          ...(factor.friendly_name != null && { friendly_name: factor.friendly_name }),
          ...(factor.factor_type !== undefined && { factor_type: factor.factor_type }),
          ...(factor.status !== undefined && { status: factor.status }),
          ...(factor.created_at !== undefined && { created_at: factor.created_at }),
          ...(factor.updated_at !== undefined && { updated_at: factor.updated_at }),
        };
      });

      const validFactors = factors.filter(f => f !== null);

      return { factors: validFactors };
    },
  });
}
