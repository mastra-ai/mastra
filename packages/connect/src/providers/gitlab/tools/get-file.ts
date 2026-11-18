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

export const getFileInputSchema = z.object({
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
  ref: z.string().optional().describe('Name of branch, tag, or commit. Defaults to the default branch if omitted.'),
});

const ProviderFileSchema = z.object({
  file_name: z.string(),
  file_path: z.string(),
  size: z.number(),
  encoding: z.string(),
  content: z.string(),
  content_sha256: z.string(),
  ref: z.string(),
  blob_id: z.string(),
  commit_id: z.string(),
  last_commit_id: z.string(),
  execute_filemode: z.boolean(),
});

export const getFileOutputSchema = z.object({
  file_name: z.string(),
  file_path: z.string(),
  size: z.number(),
  encoding: z.string(),
  content: z.string(),
  content_sha256: z.string(),
  ref: z.string(),
  blob_id: z.string(),
  commit_id: z.string(),
  last_commit_id: z.string(),
  execute_filemode: z.boolean(),
});

export function getFileTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_get_file',
    description: 'Fetch a GitLab repository file.',
    inputSchema: getFileInputSchema,
    outputSchema: getFileOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getFileOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.gitlab.com/api/repository_files/#retrieve-a-file-from-a-repository
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/repository/files/${encodeURIComponent(String(input.file_path))}`,
        params: {
          ref: input.ref ?? 'HEAD',
        },
        retries: 3,
      });

      const providerFile = ProviderFileSchema.parse(response.data);

      return {
        file_name: providerFile.file_name,
        file_path: providerFile.file_path,
        size: providerFile.size,
        encoding: providerFile.encoding,
        content: providerFile.content,
        content_sha256: providerFile.content_sha256,
        ref: providerFile.ref,
        blob_id: providerFile.blob_id,
        commit_id: providerFile.commit_id,
        last_commit_id: providerFile.last_commit_id,
        execute_filemode: providerFile.execute_filemode,
      };
    },
  });
}
