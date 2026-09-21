// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createLabelInputSchema = z.object({
  owner: z.string().describe('Repository owner. Example: "octocat"'),
  repo: z.string().describe('Repository name. Example: "hello-world"'),
  name: z.string().describe('Label name. Example: "bug"'),
  color: z.string().describe('Color of the label in hexadecimal format without leading hash. Example: "ff0000"'),
  description: z.string().optional().describe('Description of the label. Example: "Something is broken"'),
});

const ProviderLabelSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  url: z.string(),
  name: z.string(),
  color: z.string(),
  default: z.boolean(),
  description: z.string().nullable().optional(),
});

export const createLabelOutputSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  url: z.string(),
  name: z.string(),
  color: z.string(),
  default: z.boolean(),
  description: z.string().optional(),
});

export function createLabelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_create_label',
    description: 'Create a repository label with name, color, and description',
    inputSchema: createLabelInputSchema,
    outputSchema: createLabelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createLabelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/issues/labels#create-a-label
      const response = await platformProxy.post({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/labels`,
        data: {
          name: input.name,
          color: input.color,
          ...(input.description !== undefined && { description: input.description }),
        },
        retries: 3,
      });

      const providerLabel = ProviderLabelSchema.parse(response.data);

      return {
        id: providerLabel.id,
        node_id: providerLabel.node_id,
        url: providerLabel.url,
        name: providerLabel.name,
        color: providerLabel.color,
        default: providerLabel.default,
        ...(providerLabel.description !== null && { description: providerLabel.description }),
      };
    },
  });
}
