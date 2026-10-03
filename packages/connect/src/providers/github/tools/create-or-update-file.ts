// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createOrUpdateFileInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. Example: "octocat"'),
  repo: z.string().describe('The name of the repository. Example: "hello-world"'),
  path: z.string().describe('The file path in the repository. Example: "path/to/file.md"'),
  message: z.string().describe('The commit message. Example: "My commit message"'),
  content: z.string().describe('The new file content. This will be Base64 encoded automatically.'),
  branch: z
    .string()
    .optional()
    .describe("The branch name. Defaults to the repository's default branch if not provided."),
  sha: z
    .string()
    .optional()
    .describe(
      'The blob SHA of the file being replaced. Required for updating an existing file. If not provided, the action will attempt to fetch the current SHA.',
    ),
  committer: z
    .object({
      name: z.string(),
      email: z.string(),
      date: z.string().optional(),
    })
    .optional()
    .describe('The person that committed the file. Defaults to the authenticated user.'),
  author: z
    .object({
      name: z.string(),
      email: z.string(),
      date: z.string().optional(),
    })
    .optional()
    .describe('The author of the file. Default: the committer or the authenticated user if you omit committer.'),
});

const ProviderContentSchema = z.object({
  name: z.string(),
  path: z.string(),
  sha: z.string(),
  size: z.number(),
  url: z.string(),
  html_url: z.string().nullable(),
  git_url: z.string().nullable(),
  download_url: z.string().nullable(),
  type: z.string(),
  _links: z.object({
    self: z.string(),
    git: z.string().nullable(),
    html: z.string().nullable(),
  }),
});

const ProviderCommitSchema = z.object({
  sha: z.string(),
  node_id: z.string(),
  url: z.string(),
  html_url: z.string(),
  author: z.object({
    date: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  committer: z.object({
    date: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  message: z.string(),
  tree: z.object({
    url: z.string(),
    sha: z.string(),
  }),
  parents: z.array(
    z.object({
      url: z.string(),
      html_url: z.string(),
      sha: z.string(),
    }),
  ),
  verification: z.object({
    verified: z.boolean(),
    reason: z.string(),
    signature: z.string().nullable(),
    payload: z.string().nullable(),
    verified_at: z.string().nullable(),
  }),
});

const ProviderResponseSchema = z.object({
  content: ProviderContentSchema.nullable(),
  commit: ProviderCommitSchema,
});

export const createOrUpdateFileOutputSchema = z.object({
  content: z
    .object({
      name: z.string(),
      path: z.string(),
      sha: z.string(),
      size: z.number(),
      url: z.string(),
      html_url: z.string().optional(),
      git_url: z.string().optional(),
      download_url: z.string().optional(),
      type: z.string(),
    })
    .optional(),
  commit: z.object({
    sha: z.string(),
    node_id: z.string(),
    url: z.string(),
    html_url: z.string(),
    message: z.string(),
    author: z.object({
      date: z.string(),
      name: z.string(),
      email: z.string(),
    }),
    committer: z.object({
      date: z.string(),
      name: z.string(),
      email: z.string(),
    }),
    tree: z.object({
      url: z.string(),
      sha: z.string(),
    }),
    parents: z.array(
      z.object({
        url: z.string(),
        html_url: z.string(),
        sha: z.string(),
      }),
    ),
    verification: z.object({
      verified: z.boolean(),
      reason: z.string(),
      signature: z.string().optional(),
      payload: z.string().optional(),
      verified_at: z.string().optional(),
    }),
  }),
});

export function createOrUpdateFileTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_create_or_update_file',
    description: 'Create a new file or update existing repository contents in a branch.',
    inputSchema: createOrUpdateFileInputSchema,
    outputSchema: createOrUpdateFileOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createOrUpdateFileOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const { owner, repo, path, message, content, branch, sha, committer, author } = input;

      // Get the current SHA if updating an existing file and sha not provided
      const encodedPath = path.split('/').map(encodeURIComponent).join('/');
      let fileSha = sha;
      if (!fileSha) {
        // @allowTryCatch: We need to handle the 404 case gracefully to determine if we're creating a new file or updating an existing one
        try {
          // https://docs.github.com/en/rest/repos/contents#get-repository-content
          const getResponse = await platformProxy.get({
            endpoint: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`,
            params: branch ? { ref: branch } : {},
            retries: 3,
          });

          if (getResponse.data && typeof getResponse.data === 'object' && 'sha' in getResponse.data) {
            const data = getResponse.data;
            if (data && typeof data === 'object' && 'sha' in data && typeof data.sha === 'string') {
              fileSha = data.sha;
            }
          }
        } catch (error: unknown) {
          const isNotFound =
            error !== null &&
            typeof error === 'object' &&
            'response' in error &&
            error.response !== null &&
            typeof error.response === 'object' &&
            'status' in error.response &&
            error.response.status === 404;
          if (!isNotFound) {
            throw error;
          }
          // 404 means file doesn't exist; proceed without SHA to create it
        }
      }

      // Encode content to Base64
      const encodedContent = Buffer.from(content).toString('base64');

      // Build request body
      const requestBody: Record<string, unknown> = {
        message,
        content: encodedContent,
      };

      if (fileSha) {
        requestBody['sha'] = fileSha;
      }

      if (branch) {
        requestBody['branch'] = branch;
      }

      if (committer) {
        requestBody['committer'] = committer;
      }

      if (author) {
        requestBody['author'] = author;
      }

      // https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents
      const response = await platformProxy.put({
        endpoint: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`,
        data: requestBody,
        retries: 1,
      });

      const result = ProviderResponseSchema.parse(response.data);

      return {
        ...(result.content && {
          content: {
            name: result.content.name,
            path: result.content.path,
            sha: result.content.sha,
            size: result.content.size,
            url: result.content.url,
            ...(result.content.html_url && { html_url: result.content.html_url }),
            ...(result.content.git_url && { git_url: result.content.git_url }),
            ...(result.content.download_url && { download_url: result.content.download_url }),
            type: result.content.type,
          },
        }),
        commit: {
          sha: result.commit.sha,
          node_id: result.commit.node_id,
          url: result.commit.url,
          html_url: result.commit.html_url,
          message: result.commit.message,
          author: result.commit.author,
          committer: result.commit.committer,
          tree: result.commit.tree,
          parents: result.commit.parents,
          verification: {
            verified: result.commit.verification.verified,
            reason: result.commit.verification.reason,
            ...(result.commit.verification.signature && { signature: result.commit.verification.signature }),
            ...(result.commit.verification.payload && { payload: result.commit.verification.payload }),
            ...(result.commit.verification.verified_at && { verified_at: result.commit.verification.verified_at }),
          },
        },
      };
    },
  });
}
