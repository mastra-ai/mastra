// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listTransitionsInputSchema = z.object({
  issueIdOrKey: z.string().describe('The ID or key of the issue. Example: "PROJ-123" or "10001"'),
  expand: z.enum(['transitions.fields']).optional().describe('Additional fields to expand in the response'),
});

const StatusSchema = z.object({
  id: z.string().describe('Status ID'),
  name: z.string().describe('Status name'),
  statusCategory: z
    .object({
      id: z.number(),
      key: z.string(),
      colorName: z.string(),
      name: z.string(),
    })
    .optional(),
});

const FieldsSchema = z.object({
  description: z.string().optional(),
  hasScreen: z.boolean().optional(),
  isConditional: z.boolean().optional(),
  isGlobal: z.boolean().optional(),
  isInitial: z.boolean().optional(),
});

const TransitionSchema = z.object({
  id: z.string().describe('Transition ID'),
  name: z.string().describe('Transition name'),
  to: StatusSchema.describe('The status the transition moves the issue to'),
  fields: z.record(z.string(), FieldsSchema).optional().describe('Fields available during the transition'),
  hasScreen: z.boolean().optional(),
  isConditional: z.boolean().optional(),
  isGlobal: z.boolean().optional(),
  isInitial: z.boolean().optional(),
});

const ProviderResponseSchema = z.object({
  expand: z.string().optional(),
  transitions: z.array(TransitionSchema),
});

export const listTransitionsOutputSchema = z.object({
  transitions: z.array(TransitionSchema).describe('Available workflow transitions for the issue'),
});

export function listTransitionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_list_transitions',
    description: 'List available workflow transitions for a Jira issue',
    inputSchema: listTransitionsInputSchema,
    outputSchema: listTransitionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listTransitionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Get cloudId and baseUrl from connection config, metadata, or accessible-resources endpoint
      let cloudId: string | undefined;
      let baseUrl: string | undefined;

      const connection = await platformProxy.getConnection();

      // Try connection config first
      if (connection.connection_config && typeof connection.connection_config === 'object') {
        const config = connection.connection_config;
        if ('cloudId' in config && typeof config['cloudId'] === 'string') {
          cloudId = config['cloudId'];
        }
        if ('baseUrl' in config && typeof config['baseUrl'] === 'string') {
          baseUrl = config['baseUrl'];
        }
      }

      // If not found, check metadata
      if (!cloudId || !baseUrl) {
        const metadata = await platformProxy.getMetadata<Record<string, string>>();
        if (!cloudId && metadata && typeof metadata['cloudId'] === 'string') {
          cloudId = metadata['cloudId'];
        }
        if (!baseUrl && metadata && typeof metadata['baseUrl'] === 'string') {
          baseUrl = metadata['baseUrl'];
        }
      }

      // If still not found, call accessible-resources endpoint
      if (!cloudId || !baseUrl) {
        // https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/#3--retrieve-the-cloudid-for-your-site
        const accessibleResourcesResponse = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resourcesSchema = z.array(
          z.object({
            id: z.string(),
            url: z.string(),
            name: z.string().optional(),
          }),
        );

        const resources = resourcesSchema.parse(accessibleResourcesResponse.data);

        if (!resources || resources.length === 0) {
          throw new platformProxy.ActionError({
            type: 'no_accessible_resources',
            message: 'No accessible Jira resources found for this connection',
          });
        }

        const firstResource = resources[0];
        if (!firstResource) {
          throw new platformProxy.ActionError({
            type: 'no_accessible_resources',
            message: 'No accessible Jira resources found for this connection',
          });
        }

        cloudId = firstResource.id;
        baseUrl = firstResource.url;

        // Cache for subsequent runs
        await platformProxy.updateMetadata({
          cloudId: cloudId,
          baseUrl: baseUrl,
        });
      }

      if (!cloudId) {
        throw new platformProxy.ActionError({
          type: 'missing_cloud_id',
          message: 'Unable to determine Jira Cloud ID',
        });
      }

      const params: Record<string, string> = {};
      if (input.expand) {
        params['expand'] = input.expand;
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-issueidorkey-transitions-get
      const response = await platformProxy.get({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/issue/${input.issueIdOrKey}/transitions`,
        params,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 3,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      return {
        transitions: providerData.transitions,
      };
    },
  });
}
