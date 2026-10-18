// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listProjectComponentsInputSchema = z.object({
  projectIdOrKey: z
    .string()
    .describe('The ID or key of the project to list components for. Example: "10000" or "PROJ"'),
});

const ComponentSchema = z.object({
  id: z.string().describe('Component ID. Example: "10000"'),
  name: z.string().describe('Component name. Example: "Component 1"'),
  description: z.string().optional().nullable().describe('Component description'),
  project: z.string().optional().describe('Project key the component belongs to'),
  projectId: z.number().optional().describe('Project ID the component belongs to'),
  self: z.string().optional().describe('URL to the component resource'),
  assigneeType: z.string().optional().describe('Type of assignee for this component'),
  leadAccountId: z.string().optional().describe('Account ID of the component lead'),
  isAssigneeTypeValid: z.boolean().optional().describe('Whether the assignee type is valid'),
});

export const listProjectComponentsOutputSchema = z.object({
  components: z.array(ComponentSchema).describe('List of project components'),
  count: z.number().describe('Number of components returned'),
});

const CloudIdMetadataSchema = z.object({
  cloudId: z.string().describe('Jira cloud ID'),
  baseUrl: z.string().describe('Jira base URL'),
});

export function listProjectComponentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_list_project_components',
    description: 'List components for a Jira project',
    inputSchema: listProjectComponentsInputSchema,
    outputSchema: listProjectComponentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listProjectComponentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();

      const ConnectionConfigSchema = z.object({
        cloudId: z.string().optional(),
        baseUrl: z.string().optional(),
      });

      const parsedConfig = ConnectionConfigSchema.safeParse(connection.connection_config);
      let cloudId = parsedConfig.success ? parsedConfig.data.cloudId : undefined;
      let baseUrl = parsedConfig.success ? parsedConfig.data.baseUrl : undefined;

      if (!cloudId || !baseUrl) {
        const metadata = await platformProxy.getMetadata<z.infer<typeof CloudIdMetadataSchema>>();
        cloudId = cloudId || metadata?.cloudId;
        baseUrl = baseUrl || metadata?.baseUrl;

        if (!cloudId || !baseUrl) {
          // https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/#access-resources
          const resp = await platformProxy.get({
            endpoint: 'oauth/token/accessible-resources',
            retries: 3,
          });

          const AccessibleResourceSchema = z.object({ id: z.string(), url: z.string() });
          const parsed = AccessibleResourceSchema.safeParse(resp.data?.[0]);
          if (!parsed.success) {
            throw new platformProxy.ActionError({
              type: 'missing_cloud_id',
              message: 'Unable to resolve Jira cloudId and baseUrl from connection or metadata',
            });
          }
          if (!cloudId) cloudId = parsed.data.id;
          if (!baseUrl) baseUrl = parsed.data.url;

          await platformProxy.updateMetadata({ cloudId, baseUrl });
        }
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-project-components/#api-rest-api-3-project-projectidorkey-components-get
      const response = await platformProxy.get({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/project/${input.projectIdOrKey}/components`,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'no_data',
          message: 'No data returned from Jira API',
          projectIdOrKey: input.projectIdOrKey,
        });
      }

      const rawComponents = z.array(z.unknown()).parse(response.data);

      const components = [];
      for (const raw of rawComponents) {
        const parsed = ComponentSchema.safeParse(raw);
        if (!parsed.success) {
          await platformProxy.log(`Failed to parse component: ${JSON.stringify(parsed.error)}`);
          continue;
        }
        components.push(parsed.data);
      }

      return {
        components,
        count: components.length,
      };
    },
  });
}
