// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';
import { withoutSecretFields } from '../../../runtime/redact.js';

export const createProjectInputSchema = z.object({
  name: z.string().describe('Name of the new project. Example: "my-new-project"'),
  path: z.string().optional().describe('Repository name for the new project. Generated from name if not provided.'),
  namespace_id: z
    .number()
    .optional()
    .describe('Namespace ID for the new project. Defaults to the current user namespace.'),
  description: z.string().optional().describe('Short project description.'),
  visibility: z.enum(['private', 'internal', 'public']).optional().describe('Visibility level of the project.'),
  initialize_with_readme: z.boolean().optional().describe('Whether to initialize the project with a README file.'),
  default_branch: z.string().optional().describe('Default branch name. Requires initialize_with_readme to be true.'),
});

const NamespaceSchema = z.object({
  id: z.number(),
  name: z.string(),
  path: z.string(),
  kind: z.string().optional(),
  full_path: z.string().optional(),
  parent_id: z.number().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  web_url: z.string().optional(),
});

export const createProjectOutputSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    name_with_namespace: z.string().optional(),
    path: z.string(),
    path_with_namespace: z.string().optional(),
    description: z.string().nullable().optional(),
    default_branch: z.string().nullable().optional(),
    visibility: z.string().optional(),
    ssh_url_to_repo: z.string().optional(),
    http_url_to_repo: z.string().optional(),
    web_url: z.string().optional(),
    readme_url: z.string().nullable().optional(),
    created_at: z.string().optional(),
    last_activity_at: z.string().optional(),
    namespace: NamespaceSchema.optional(),
    topics: z.array(z.string()).optional(),
    empty_repo: z.boolean().optional(),
    archived: z.boolean().optional(),
    creator_id: z.number().optional(),
  })
  .passthrough();

/** Provider secrets removed before the result leaves the tool. */
export const createProjectOutputSchemaRedacted = createProjectOutputSchema;

export function createProjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_create_project',
    description: 'Create a project in GitLab.',
    inputSchema: createProjectInputSchema,
    outputSchema: createProjectOutputSchemaRedacted,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createProjectOutputSchemaRedacted>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const result = await (async (): Promise<z.infer<typeof createProjectOutputSchema>> => {
        const response = await platformProxy.post({
          // https://docs.gitlab.com/api/projects/#create-project
          endpoint: '/api/v4/projects',
          data: {
            name: input.name,
            ...(input.path !== undefined && { path: input.path }),
            ...(input.namespace_id !== undefined && { namespace_id: input.namespace_id }),
            ...(input.description !== undefined && { description: input.description }),
            ...(input.visibility !== undefined && { visibility: input.visibility }),
            ...(input.initialize_with_readme !== undefined && { initialize_with_readme: input.initialize_with_readme }),
            ...(input.default_branch !== undefined && { default_branch: input.default_branch }),
          },
          retries: 1,
        });

        const providerProject = createProjectOutputSchema.parse(response.data);

        return providerProject;
      })();
      return withoutSecretFields(result, ['runners_token']);
    },
  });
}
