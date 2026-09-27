// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const LabelSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  url: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  default: z.boolean(),
});

export const listLabelsInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository'),
  repo: z.string().describe('The name of the repository'),
  per_page: z.number().int().min(1).max(100).optional().describe('The number of results per page (max 100)'),
  page: z.number().int().min(1).optional().describe('The page number of the results to fetch'),
});

export const listLabelsOutputSchema = z.object({
  labels: z.array(LabelSchema),
  next_page: z.number().optional(),
});

export function listLabelsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_list_labels',
    description: 'List repository labels with pagination',
    inputSchema: listLabelsInputSchema,
    outputSchema: listLabelsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listLabelsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/issues/labels#list-labels-for-a-repository
      const response = await platformProxy.get({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/labels`,
        params: {
          ...(input.per_page !== undefined && { per_page: String(input.per_page) }),
          ...(input.page !== undefined && { page: String(input.page) }),
        },
        retries: 3,
      });

      const labels = z.array(LabelSchema).parse(response.data);

      return {
        labels: labels,
        ...(input.per_page !== undefined &&
          input.page !== undefined &&
          labels.length === input.per_page && { next_page: input.page + 1 }),
      };
    },
  });
}
