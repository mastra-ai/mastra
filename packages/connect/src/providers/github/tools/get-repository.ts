// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getRepositoryInputSchema = z.object({
  owner: z.string().describe('Repository owner. Example: "octocat"'),
  repo: z.string().describe('Repository name. Example: "Hello-World"'),
});

const OwnerSchema = z.object({
  login: z.string(),
  id: z.number(),
  type: z.string().optional(),
});

const ProviderRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string().optional(),
  description: z.string().nullable().optional(),
  private: z.boolean(),
  visibility: z.string().optional(),
  default_branch: z.string().optional(),
  html_url: z.string().optional(),
  owner: OwnerSchema,
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  pushed_at: z.string().nullable().optional(),
});

export const getRepositoryOutputSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string().optional(),
  description: z.string().optional(),
  private: z.boolean(),
  visibility: z.string().optional(),
  default_branch: z.string().optional(),
  html_url: z.string().optional(),
  owner: z.object({
    login: z.string(),
    id: z.number(),
    type: z.string().optional(),
  }),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export function getRepositoryTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_get_repository',
    description: 'Retrieve repository metadata, visibility, default branch, and owner info.',
    inputSchema: getRepositoryInputSchema,
    outputSchema: getRepositoryOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getRepositoryOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/repos/repos#get-a-repository
      const response = await platformProxy.get({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Repository not found',
          owner: input.owner,
          repo: input.repo,
        });
      }

      const providerRepo = ProviderRepositorySchema.parse(response.data);

      return {
        id: providerRepo.id,
        name: providerRepo.name,
        ...(providerRepo.full_name !== undefined && { full_name: providerRepo.full_name }),
        ...(providerRepo.description != null && { description: providerRepo.description }),
        private: providerRepo.private,
        ...(providerRepo.visibility !== undefined && { visibility: providerRepo.visibility }),
        ...(providerRepo.default_branch !== undefined && { default_branch: providerRepo.default_branch }),
        ...(providerRepo.html_url !== undefined && { html_url: providerRepo.html_url }),
        owner: {
          login: providerRepo.owner.login,
          id: providerRepo.owner.id,
          ...(providerRepo.owner.type !== undefined && { type: providerRepo.owner.type }),
        },
        ...(providerRepo.created_at !== undefined && { created_at: providerRepo.created_at }),
        ...(providerRepo.updated_at !== undefined && { updated_at: providerRepo.updated_at }),
      };
    },
  });
}
