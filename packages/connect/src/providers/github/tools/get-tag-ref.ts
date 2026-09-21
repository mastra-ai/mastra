// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getTagRefInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "octocat"'),
  repo: z.string().describe('The name of the repository. Example: "hello-world"'),
  ref: z
    .string()
    .describe(
      'The Git reference to retrieve. Use "tags/<tag_name>" for tags or "heads/<branch_name>" for branches. Example: "tags/v1.0.0"',
    ),
});

const ProviderRefObjectSchema = z.object({
  type: z.string(),
  sha: z.string(),
  url: z.string(),
});

const ProviderRefSchema = z.object({
  ref: z.string(),
  node_id: z.string(),
  url: z.string(),
  object: ProviderRefObjectSchema,
});

export const getTagRefOutputSchema = z.object({
  ref: z.string(),
  node_id: z.string(),
  url: z.string(),
  object: z.object({
    type: z.string(),
    sha: z.string(),
    url: z.string(),
  }),
});

export function getTagRefTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_get_tag_ref',
    description: 'Retrieve a tag ref or branch-style Git reference',
    inputSchema: getTagRefInputSchema,
    outputSchema: getTagRefOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getTagRefOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.github.com/en/rest/git/refs#get-a-reference
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/ref/${encodeURIComponent(input.ref)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Reference not found',
          ref: input.ref,
        });
      }

      const providerRef = ProviderRefSchema.parse(response.data);

      return {
        ref: providerRef.ref,
        node_id: providerRef.node_id,
        url: providerRef.url,
        object: {
          type: providerRef.object.type,
          sha: providerRef.object.sha,
          url: providerRef.object.url,
        },
      };
    },
  });
}
