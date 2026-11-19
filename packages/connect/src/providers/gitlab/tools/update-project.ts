// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

/** Encodes one GitLab path segment exactly once, whether `value` arrives raw or already URL-encoded. */
function gitlabPathSegment(value: string | number): string {
  const text = String(value);
  try {
    return encodeURIComponent(decodeURIComponent(text));
  } catch {
    return encodeURIComponent(text);
  }
}

export const updateProjectInputSchema = z
  .object({
    id: z
      .union([
        z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        z
          .string()
          .min(1)
          .refine(value => {
            try {
              encodeURIComponent(value);
              return true;
            } catch {
              return false;
            }
          }, 'must not contain unpaired surrogate characters'),
      ])
      .describe('The ID or URL-encoded path of the project. Example: 82599306'),
    name: z.string().optional().describe('The name of the project.'),
    path: z.string().optional().describe('Custom repository name for the project.'),
    description: z.string().optional().describe('Short project description.'),
    visibility: z.enum(['private', 'internal', 'public']).optional().describe('Project visibility level.'),
    default_branch: z.string().optional().describe('The default branch name.'),
    topics: z.array(z.string()).optional().describe('List of topics for the project.'),
    issues_access_level: z.enum(['disabled', 'private', 'enabled']).optional().describe('Set visibility of issues.'),
    merge_requests_access_level: z
      .enum(['disabled', 'private', 'enabled'])
      .optional()
      .describe('Set visibility of merge requests.'),
    wiki_access_level: z.enum(['disabled', 'private', 'enabled']).optional().describe('Set visibility of wiki.'),
    builds_access_level: z.enum(['disabled', 'private', 'enabled']).optional().describe('Set visibility of pipelines.'),
    snippets_access_level: z
      .enum(['disabled', 'private', 'enabled'])
      .optional()
      .describe('Set visibility of snippets.'),
    pages_access_level: z
      .enum(['disabled', 'private', 'enabled', 'public'])
      .optional()
      .describe('Set visibility of GitLab Pages.'),
    container_registry_access_level: z
      .enum(['disabled', 'private', 'enabled'])
      .optional()
      .describe('Set visibility of container registry.'),
    only_allow_merge_if_pipeline_succeeds: z
      .boolean()
      .optional()
      .describe('Set whether merge requests can only be merged with successful jobs.'),
    remove_source_branch_after_merge: z
      .boolean()
      .optional()
      .describe('Enable deleting source branch after merge by default.'),
    merge_method: z.enum(['merge', 'rebase_merge', 'ff']).optional().describe('Merge method used for the project.'),
    squash_option: z
      .enum(['never', 'always', 'default_on', 'default_off'])
      .optional()
      .describe('Squash option for merge requests.'),
    public_jobs: z.boolean().optional().describe('If true, jobs can be viewed by non-project members.'),
    shared_runners_enabled: z.boolean().optional().describe('Enable instance runners for this project.'),
    autoclose_referenced_issues: z
      .boolean()
      .optional()
      .describe('Set whether auto-closing referenced issues on default branch.'),
    request_access_enabled: z.boolean().optional().describe('Allow users to request member access.'),
    emails_enabled: z.boolean().optional().describe('Enable email notifications.'),
  })
  .refine(data => Object.entries(data).some(([key, value]) => !['id'].includes(key) && value !== undefined), {
    message: 'Provide at least one field to update.',
  });

const NamespaceSchema = z.object({
  id: z.number(),
  name: z.string(),
  path: z.string(),
  kind: z.string().optional(),
  full_path: z.string().optional(),
});

const ProviderProjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  path: z.string(),
  description: z.string().nullable().optional(),
  visibility: z.string().optional(),
  default_branch: z.string().nullish(),
  web_url: z.string().optional(),
  topics: z.array(z.string()).optional(),
  namespace: NamespaceSchema.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  last_activity_at: z.string().optional(),
});

export const updateProjectOutputSchema = z.object({
  id: z.number(),
  name: z.string(),
  path: z.string(),
  description: z.string().optional(),
  visibility: z.string().optional(),
  default_branch: z.string().nullish(),
  web_url: z.string().optional(),
  topics: z.array(z.string()).optional(),
  namespace_id: z.number().optional(),
  namespace_name: z.string().optional(),
  namespace_path: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export function updateProjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_update_project',
    description: 'Update a project in GitLab.',
    inputSchema: updateProjectInputSchema,
    outputSchema: updateProjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateProjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = typeof input.id === 'number' ? String(input.id) : input.id;

      const response = await platformProxy.put({
        // https://docs.gitlab.com/api/projects/#edit-project
        endpoint: `/api/v4/projects/${gitlabPathSegment(projectId)}`,
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.path !== undefined && { path: input.path }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.visibility !== undefined && { visibility: input.visibility }),
          ...(input.default_branch !== undefined && { default_branch: input.default_branch }),
          ...(input.topics !== undefined && { topics: input.topics }),
          ...(input.issues_access_level !== undefined && { issues_access_level: input.issues_access_level }),
          ...(input.merge_requests_access_level !== undefined && {
            merge_requests_access_level: input.merge_requests_access_level,
          }),
          ...(input.wiki_access_level !== undefined && { wiki_access_level: input.wiki_access_level }),
          ...(input.builds_access_level !== undefined && { builds_access_level: input.builds_access_level }),
          ...(input.snippets_access_level !== undefined && { snippets_access_level: input.snippets_access_level }),
          ...(input.pages_access_level !== undefined && { pages_access_level: input.pages_access_level }),
          ...(input.container_registry_access_level !== undefined && {
            container_registry_access_level: input.container_registry_access_level,
          }),
          ...(input.only_allow_merge_if_pipeline_succeeds !== undefined && {
            only_allow_merge_if_pipeline_succeeds: input.only_allow_merge_if_pipeline_succeeds,
          }),
          ...(input.remove_source_branch_after_merge !== undefined && {
            remove_source_branch_after_merge: input.remove_source_branch_after_merge,
          }),
          ...(input.merge_method !== undefined && { merge_method: input.merge_method }),
          ...(input.squash_option !== undefined && { squash_option: input.squash_option }),
          ...(input.public_jobs !== undefined && { public_jobs: input.public_jobs }),
          ...(input.shared_runners_enabled !== undefined && { shared_runners_enabled: input.shared_runners_enabled }),
          ...(input.autoclose_referenced_issues !== undefined && {
            autoclose_referenced_issues: input.autoclose_referenced_issues,
          }),
          ...(input.request_access_enabled !== undefined && { request_access_enabled: input.request_access_enabled }),
          ...(input.emails_enabled !== undefined && { emails_enabled: input.emails_enabled }),
        },
        retries: 1,
      });

      const providerProject = ProviderProjectSchema.parse(response.data);

      return {
        id: providerProject.id,
        name: providerProject.name,
        path: providerProject.path,
        ...(providerProject.description != null && { description: providerProject.description }),
        ...(providerProject.visibility != null && { visibility: providerProject.visibility }),
        ...(providerProject.default_branch != null && { default_branch: providerProject.default_branch }),
        ...(providerProject.web_url != null && { web_url: providerProject.web_url }),
        ...(providerProject.topics != null && { topics: providerProject.topics }),
        ...(providerProject.namespace != null && {
          namespace_id: providerProject.namespace.id,
          namespace_name: providerProject.namespace.name,
          namespace_path: providerProject.namespace.path,
        }),
        ...(providerProject.created_at != null && { created_at: providerProject.created_at }),
        ...(providerProject.updated_at != null && { updated_at: providerProject.updated_at }),
      };
    },
  });
}
