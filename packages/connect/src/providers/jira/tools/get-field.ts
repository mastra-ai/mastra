// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getFieldInputSchema = z.object({
  fieldId: z
    .string()
    .describe('The ID of the field to retrieve. For example: "summary", "description", or "customfield_10101"'),
});

const SchemaFieldSchema = z.object({
  type: z.string().optional(),
  system: z.string().optional(),
  custom: z.string().optional(),
  customId: z.number().optional(),
  items: z.string().optional(),
});

export const getFieldOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  custom: z.boolean(),
  clauseNames: z.array(z.string()),
  navigable: z.boolean(),
  orderable: z.boolean(),
  searchable: z.boolean(),
  key: z.string().optional(),
  schema: SchemaFieldSchema.optional(),
});

const JiraResourceSchema = z.object({
  id: z.string(),
  url: z.string(),
});

interface MetadataType {
  cloudId?: string;
  baseUrl?: string;
}

export function getFieldTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_get_field',
    description: 'Retrieve Jira field metadata by field ID',
    inputSchema: getFieldInputSchema,
    outputSchema: getFieldOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getFieldOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Validate input using Zod
      await platformProxy.zodValidateInput({ zodSchema: getFieldInputSchema, input });

      // Get cloudId from connection config or metadata
      const connection = await platformProxy.getConnection();
      let cloudId: string | undefined = connection.connection_config?.['cloudId'];
      let baseUrl: string | undefined = connection.connection_config?.['baseUrl'];

      if (!cloudId || !baseUrl) {
        const metadata = await platformProxy.getMetadata<MetadataType>();
        cloudId = metadata?.cloudId;
        baseUrl = metadata?.baseUrl;
      }

      if (!cloudId || !baseUrl) {
        // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-oauth-token-accessible-resources/
        const accessibleResourcesResponse = await platformProxy.get({
          endpoint: 'https://api.atlassian.com/oauth/token/accessible-resources',
          retries: 3,
        });

        const resources = accessibleResourcesResponse.data;
        if (!Array.isArray(resources) || resources.length === 0) {
          throw new platformProxy.ActionError({
            message: 'No accessible Jira resources found for this connection',
          });
        }

        const parsedResource = JiraResourceSchema.safeParse(resources[0]);
        if (!parsedResource.success) {
          throw new platformProxy.ActionError({
            message: 'Invalid Jira resource format returned from API',
          });
        }

        cloudId = parsedResource.data.id;
        baseUrl = parsedResource.data.url;
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-fields/#api-rest-api-3-field-get
      const response = await platformProxy.get({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/field`,
        retries: 3,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
      });

      const fields = response.data;
      if (!Array.isArray(fields)) {
        throw new platformProxy.ActionError({
          message: 'Unexpected response format from Jira API',
        });
      }

      const field = fields.find((f: { id: string }) => f.id === input.fieldId);

      if (!field) {
        throw new platformProxy.ActionError({
          message: `Field with ID '${input.fieldId}' not found`,
        });
      }

      return field;
    },
  });
}
