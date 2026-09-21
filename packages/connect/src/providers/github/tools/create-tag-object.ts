// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createTagObjectInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "octocat"'),
  repo: z.string().describe('The name of the repository. Example: "hello-world"'),
  tag: z.string().describe('The name of the tag. Example: "v1.0.0"'),
  message: z.string().describe('The tag message. Example: "Release v1.0.0"'),
  object: z
    .string()
    .describe('The SHA of the git object this tag points to. Example: "c3d0be41cbeaa591f95c7208cc9321296ff76a1c"'),
  type: z.enum(['commit', 'tree', 'blob']).describe('The type of the object the tag points to.'),
  tagger_name: z.string().describe('The name of the person creating the tag. Example: "Monalisa Octocat"'),
  tagger_email: z.string().describe('The email of the person creating the tag. Example: "octocat@github.com"'),
  tagger_date: z
    .string()
    .optional()
    .describe(
      'The date the tag was created (ISO 8601 format). Defaults to current time if not provided. Example: "2024-01-01T00:00:00Z"',
    ),
});

const TagObjectSchema = z.object({
  sha: z.string(),
  url: z.string(),
  tagger: z.object({
    name: z.string(),
    email: z.string(),
    date: z.string(),
  }),
  object: z.object({
    sha: z.string(),
    type: z.string(),
    url: z.string(),
  }),
  tag: z.string(),
  message: z.string(),
});

export const createTagObjectOutputSchema = z.object({
  sha: z.string(),
  url: z.string(),
  tagger_name: z.string(),
  tagger_email: z.string(),
  tagger_date: z.string(),
  object_sha: z.string(),
  object_type: z.string(),
  object_url: z.string(),
  tag: z.string(),
  message: z.string(),
});

export function createTagObjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_create_tag_object',
    description: 'Create an annotated Git tag object for a commit or object SHA.',
    inputSchema: createTagObjectInputSchema,
    outputSchema: createTagObjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createTagObjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/git/tags#create-a-tag-object
      const response = await platformProxy.post({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/tags`,
        data: {
          tag: input.tag,
          message: input.message,
          object: input.object,
          type: input.type,
          tagger: {
            name: input.tagger_name,
            email: input.tagger_email,
            ...(input.tagger_date !== undefined && { date: input.tagger_date }),
          },
        },
        retries: 3,
      });

      const tagObject = TagObjectSchema.parse(response.data);

      return {
        sha: tagObject.sha,
        url: tagObject.url,
        tagger_name: tagObject.tagger.name,
        tagger_email: tagObject.tagger.email,
        tagger_date: tagObject.tagger.date,
        object_sha: tagObject.object.sha,
        object_type: tagObject.object.type,
        object_url: tagObject.object.url,
        tag: tagObject.tag,
        message: tagObject.message,
      };
    },
  });
}
