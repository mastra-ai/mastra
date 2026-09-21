// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getLabelInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "octocat"'),
  repo: z.string().describe('The name of the repository. Example: "hello-world"'),
  name: z.string().describe('The name of the label. Example: "bug"'),
});

const ProviderLabelSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  url: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  default: z.boolean(),
});

export const getLabelOutputSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  url: z.string(),
  name: z.string(),
  description: z.string().optional(),
  color: z.string(),
  default: z.boolean(),
});

export function getLabelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_get_label',
    description: 'Retrieve a single repository label by name.',
    inputSchema: getLabelInputSchema,
    outputSchema: getLabelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getLabelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.github.com/en/rest/issues/labels#get-a-label
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/labels/${encodeURIComponent(input.name)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Label not found',
          owner: input.owner,
          repo: input.repo,
          name: input.name,
        });
      }

      const providerLabel = ProviderLabelSchema.parse(response.data);

      return {
        id: providerLabel.id,
        node_id: providerLabel.node_id,
        url: providerLabel.url,
        name: providerLabel.name,
        ...(providerLabel.description != null && { description: providerLabel.description }),
        color: providerLabel.color,
        default: providerLabel.default,
      };
    },
  });
}
