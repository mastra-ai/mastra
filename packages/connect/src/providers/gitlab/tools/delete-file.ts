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

export const deleteFileInputSchema = z.object({
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
  file_path: z.string().describe('Full path to the file. Example: hello.txt'),
  branch: z.string().describe('Name of the branch to delete the file from. Example: feature/test'),
  commit_message: z.string().describe('Commit message for the deletion.'),
  author_email: z.string().optional().describe('Commit author email address.'),
  author_name: z.string().optional().describe('Commit author name.'),
  last_commit_id: z.string().optional().describe('Last known file commit ID.'),
  start_branch: z.string().optional().describe('Name of the base branch to create the branch from.'),
});

const ProviderResponseSchema = z.object({
  file_path: z.string().optional(),
  branch: z.string().optional(),
});

export const deleteFileOutputSchema = z.object({
  file_path: z.string().optional(),
  branch: z.string().optional(),
});

export function deleteFileTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_delete_file',
    description: 'Delete a GitLab repository file.',
    inputSchema: deleteFileInputSchema,
    outputSchema: deleteFileOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteFileOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.delete({
        // https://docs.gitlab.com/api/repository_files/#delete-a-file-in-a-repository
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/repository/files/${encodeURIComponent(String(input.file_path))}`,
        data: {
          branch: input.branch,
          commit_message: input.commit_message,
          ...(input.author_email !== undefined && { author_email: input.author_email }),
          ...(input.author_name !== undefined && { author_name: input.author_name }),
          ...(input.last_commit_id !== undefined && { last_commit_id: input.last_commit_id }),
          ...(input.start_branch !== undefined && { start_branch: input.start_branch }),
        },
        retries: 1,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data || {});
      return {
        ...(providerResponse.file_path !== undefined && { file_path: providerResponse.file_path }),
        ...(providerResponse.branch !== undefined && { branch: providerResponse.branch }),
      };
    },
  });
}
