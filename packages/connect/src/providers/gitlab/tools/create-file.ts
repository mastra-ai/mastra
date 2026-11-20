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

export const createFileInputSchema = z.object({
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
  file_path: z.string().describe('Full path to the new file. Example: "hello.txt"'),
  branch: z.string().describe('Name of the branch to create the file in. Example: "main"'),
  commit_message: z.string().describe('Commit message for the file creation.'),
  content: z.string().describe('Content of the file.'),
  author_email: z.string().optional().describe('Commit author email address.'),
  author_name: z.string().optional().describe('Commit author name.'),
  encoding: z.enum(['text', 'base64']).optional().describe('File encoding. Defaults to "text".'),
  execute_filemode: z.boolean().optional().describe('If true, enables the execute flag on the file.'),
  start_branch: z.string().optional().describe('Base branch to create the new branch from.'),
});

const ProviderResponseSchema = z.object({
  file_path: z.string(),
  branch: z.string(),
});

export const createFileOutputSchema = z.object({
  file_path: z.string(),
  branch: z.string(),
});

export function createFileTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_create_file',
    description: 'Create a GitLab repository file.',
    inputSchema: createFileInputSchema,
    outputSchema: createFileOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createFileOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.gitlab.com/api/repository_files/#create-new-file-in-repository
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/repository/files/${encodeURIComponent(String(input.file_path))}`,
        data: {
          branch: input.branch,
          commit_message: input.commit_message,
          content: input.content,
          ...(input.author_email !== undefined && { author_email: input.author_email }),
          ...(input.author_name !== undefined && { author_name: input.author_name }),
          ...(input.encoding !== undefined && { encoding: input.encoding }),
          ...(input.execute_filemode !== undefined && { execute_filemode: input.execute_filemode }),
          ...(input.start_branch !== undefined && { start_branch: input.start_branch }),
        },
        retries: 1,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      return {
        file_path: providerData.file_path,
        branch: providerData.branch,
      };
    },
  });
}
