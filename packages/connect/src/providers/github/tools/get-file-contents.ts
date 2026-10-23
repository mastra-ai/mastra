// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getFileContentsInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "octocat"'),
  repo: z.string().describe('The name of the repository. Example: "Hello-World"'),
  path: z.string().describe('The path to the file or directory. Example: "README.md" or "docs/"'),
  ref: z
    .string()
    .optional()
    .describe("The name of the commit/branch/tag. Defaults to the repository's default branch."),
});

const LinksSchema = z.object({
  git: z.string().nullable().optional(),
  html: z.string().nullable().optional(),
  self: z.string().optional(),
});

const DirectoryItemSchema = z.object({
  type: z.string().describe('Type of content: file, dir, symlink, or submodule'),
  size: z.number(),
  name: z.string(),
  path: z.string(),
  sha: z.string(),
  url: z.string(),
  git_url: z.string().nullable().optional(),
  html_url: z.string().nullable().optional(),
  download_url: z.string().nullable().optional(),
  _links: LinksSchema.optional(),
});

const SingleItemSchema = z.object({
  type: z.enum(['file', 'symlink', 'submodule']).or(z.string()),
  size: z.number(),
  name: z.string(),
  path: z.string(),
  sha: z.string(),
  url: z.string(),
  git_url: z.string().nullable().optional(),
  html_url: z.string().nullable().optional(),
  download_url: z.string().nullable().optional(),
  content: z.string().optional(),
  encoding: z.string().optional(),
  target: z.string().optional(),
  submodule_git_url: z.string().optional(),
  _links: LinksSchema.optional(),
});

export const getFileContentsOutputSchema = z.object({
  type: z.enum(['file', 'dir', 'symlink', 'submodule']).or(z.string()).describe('Type of content'),
  size: z.number(),
  name: z.string(),
  path: z.string(),
  sha: z.string(),
  url: z.string(),
  git_url: z.string().optional(),
  html_url: z.string().optional(),
  download_url: z.string().optional(),
  content: z.string().optional().describe('Base64 encoded content for files'),
  encoding: z.string().optional().describe('Content encoding (e.g., base64)'),
  entries: z.array(DirectoryItemSchema).optional().describe('Directory entries when type is dir'),
  target: z.string().optional().describe('Symlink target when type is symlink'),
  submodule_git_url: z.string().optional().describe('Submodule URL when type is submodule'),
  _links: z
    .object({
      git: z.string().optional(),
      html: z.string().optional(),
      self: z.string().optional(),
    })
    .optional(),
});

export function getFileContentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_get_file_contents',
    description: 'Retrieve a file or directory entry from repository contents.',
    inputSchema: getFileContentsInputSchema,
    outputSchema: getFileContentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getFileContentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input.ref) {
        params['ref'] = input.ref;
      }

      // https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28#get-repository-content
      const encodedPath = input.path.split('/').map(encodeURIComponent).join('/');
      const response = await platformProxy.get({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/contents/${encodedPath}`,
        params: params,
        retries: 3,
      });

      if (response.status === 404) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `File or directory not found: ${input.path}`,
          path: input.path,
        });
      }

      if (Array.isArray(response.data)) {
        // Directory response
        const entries = response.data.map((item: unknown) => {
          const entry = DirectoryItemSchema.parse(item);
          return {
            type: entry.type,
            size: entry.size,
            name: entry.name,
            path: entry.path,
            sha: entry.sha,
            url: entry.url,
            ...(entry.git_url != null && { git_url: entry.git_url }),
            ...(entry.html_url != null && { html_url: entry.html_url }),
            ...(entry.download_url != null && { download_url: entry.download_url }),
            ...(entry._links && { _links: entry._links }),
          };
        });

        const result: z.infer<typeof getFileContentsOutputSchema> = {
          type: 'dir',
          size: 0,
          name: input.path.split('/').pop() || '',
          path: input.path,
          sha: '',
          url: '',
          entries: entries,
        };
        return result;
      }

      // Single item response (file, symlink, or submodule)
      const data = SingleItemSchema.parse(response.data);

      return {
        type: data.type,
        size: data.size,
        name: data.name,
        path: data.path,
        sha: data.sha,
        url: data.url,
        ...(data.git_url != null && { git_url: data.git_url }),
        ...(data.html_url != null && { html_url: data.html_url }),
        ...(data.download_url != null && { download_url: data.download_url }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.encoding !== undefined && { encoding: data.encoding }),
        ...(data.target !== undefined && { target: data.target }),
        ...(data.submodule_git_url !== undefined && { submodule_git_url: data.submodule_git_url }),
        ...(data._links && {
          _links: {
            ...(data._links.git !== undefined && { git: data._links.git || undefined }),
            ...(data._links.html !== undefined && { html: data._links.html || undefined }),
            ...(data._links.self !== undefined && { self: data._links.self }),
          },
        }),
      };
    },
  });
}
