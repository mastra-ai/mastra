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

export const deleteGroupInputSchema = z
  .object({
    group_id: z
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
      .describe('The ID or URL-encoded path of the group. Example: 123'),
    permanently_remove: z
      .boolean()
      .optional()
      .describe(
        'If true, request permanent removal of a subgroup already scheduled for deletion. GitLab completes it asynchronously.',
      ),
    full_path: z
      .string()
      .optional()
      .describe(
        'The subgroup full_path after it was scheduled for deletion (GitLab renames it). Read it with gitlab_get_group using the numeric id. Required when permanently_remove is true.',
      ),
  })
  .refine(
    data => data.permanently_remove !== true || (typeof data.full_path === 'string' && data.full_path.length > 0),
    {
      message: 'full_path is required when permanently_remove is true',
      path: ['full_path'],
    },
  );

export const deleteGroupOutputSchema = z.object({
  success: z.boolean(),
  group_id: z.union([z.number(), z.string()]).optional(),
});

export function deleteGroupTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_delete_group',
    description:
      'Schedule a group for deletion in GitLab. Pass the numeric group id: GitLab renames the group when it schedules deletion, so a path stops working. To then remove a subgroup permanently, read its renamed full_path with gitlab_get_group and call again with permanently_remove and that full_path; GitLab accepts the removal and completes it asynchronously.',
    inputSchema: deleteGroupInputSchema,
    outputSchema: deleteGroupOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteGroupOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};

      if (input.permanently_remove !== undefined) {
        params['permanently_remove'] = String(input.permanently_remove);
      }

      if (input.full_path !== undefined) {
        params['full_path'] = input.full_path;
      }

      // https://docs.gitlab.com/api/groups/#delete-a-group
      await platformProxy.delete({
        endpoint: `/api/v4/groups/${gitlabPathSegment(input.group_id)}`,
        params,
        retries: 1,
      });

      return {
        success: true,
        group_id: input.group_id,
      };
    },
  });
}
