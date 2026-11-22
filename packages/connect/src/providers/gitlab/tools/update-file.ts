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

export const updateFileInputSchema = z.object({
  project_id: z
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
    .describe(
      'Numeric project ID, or the project path raw or URL-encoded. Example: 82599306, "team/app", or "team%2Fapp"',
    ),
  file_path: z
    .string()
    .describe('Full path to the file, not URL-encoded (a %2F stays literally in the name). Example: "src/app.ts"'),
  branch: z.string().describe('Name of the branch to update the file in. Example: feature/test'),
  content: z.string().describe('The file content.'),
  commit_message: z.string().describe('Commit message.'),
  author_email: z.string().optional().describe("Commit author's email address."),
  author_name: z.string().optional().describe("Commit author's name."),
  encoding: z.enum(['text', 'base64']).optional().describe("Change encoding to 'base64'. Default is 'text'."),
  execute_filemode: z
    .boolean()
    .optional()
    .describe('If true, enables the execute flag on the file. If false, disables it.'),
  last_commit_id: z.string().optional().describe('Last known file commit ID.'),
  start_branch: z.string().optional().describe('Name of the base branch to create the branch from.'),
});

const ProviderResponseSchema = z.object({
  file_path: z.string(),
  branch: z.string(),
});

export const updateFileOutputSchema = z.object({
  file_path: z.string(),
  branch: z.string(),
});

export function updateFileTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_update_file',
    description: 'Update a GitLab repository file.',
    inputSchema: updateFileInputSchema,
    outputSchema: updateFileOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateFileOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.put({
        // https://docs.gitlab.com/api/repository_files/#update-existing-file-in-repository
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/repository/files/${encodeURIComponent(String(input.file_path))}`,
        data: {
          branch: input.branch,
          content: input.content,
          commit_message: input.commit_message,
          ...(input.author_email !== undefined && { author_email: input.author_email }),
          ...(input.author_name !== undefined && { author_name: input.author_name }),
          ...(input.encoding !== undefined && { encoding: input.encoding }),
          ...(input.execute_filemode !== undefined && { execute_filemode: input.execute_filemode }),
          ...(input.last_commit_id !== undefined && { last_commit_id: input.last_commit_id }),
          ...(input.start_branch !== undefined && { start_branch: input.start_branch }),
        },
        retries: 1,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        file_path: providerResponse.file_path,
        branch: providerResponse.branch,
      };
    },
  });
}
