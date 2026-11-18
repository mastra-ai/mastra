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

export const deleteIssueInputSchema = z.object({
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
  issue_iid: z.number().describe('The internal ID of a project issue. Example: 1'),
});

export const deleteIssueOutputSchema = z.object({
  success: z.boolean(),
  project_id: z.union([z.number(), z.string()]),
  issue_iid: z.number(),
});

export function deleteIssueTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_delete_issue',
    description: 'Delete an issue in GitLab.',
    inputSchema: deleteIssueInputSchema,
    outputSchema: deleteIssueOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteIssueOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.gitlab.com/api/issues/#delete-an-issue
      await platformProxy.delete({
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/issues/${encodeURIComponent(String(input.issue_iid))}`,
        retries: 1,
      });

      return {
        success: true,
        project_id: String(input.project_id),
        issue_iid: input.issue_iid,
      };
    },
  });
}
