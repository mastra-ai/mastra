// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const unarchiveIssueInputSchema = z.object({
  id: z.string().min(1),
});

export const unarchiveIssueOutputSchema = z.object({
  success: z.boolean(),
  issueId: z.string().nullable(),
  identifier: z.string().nullable(),
  title: z.string().nullable(),
  archivedAt: z.string().nullable(),
});

const graphQLResponseSchema = z.object({
  data: z.object({
    issueUnarchive: z.object({
      success: z.boolean(),
      lastSyncId: z.number(),
      entity: z
        .object({
          id: z.string(),
          identifier: z.string(),
          title: z.string(),
          archivedAt: z.string().nullable(),
        })
        .nullable(),
    }),
  }),
});

export function unarchiveIssueTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_unarchive_issue',
    description: 'Restore an archived Linear issue.',
    inputSchema: unarchiveIssueInputSchema,
    outputSchema: unarchiveIssueOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof unarchiveIssueOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://linear.app/developers/graphql
      const response = await platformProxy.post({
        endpoint: '/graphql',
        retries: 3,
        data: {
          query: `
                    mutation IssueUnarchive($id: String!) {
                        issueUnarchive(id: $id) {
                            success
                            lastSyncId
                            entity {
                                id
                                identifier
                                title
                                archivedAt
                            }
                        }
                    }
                `,
          variables: {
            id: input.id,
          },
        },
      });

      const parsed = graphQLResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error(`Invalid GraphQL response: ${parsed.error.message}`);
      }

      const payload = parsed.data.data.issueUnarchive;

      return {
        success: payload.success,
        issueId: payload.entity?.id ?? null,
        identifier: payload.entity?.identifier ?? null,
        title: payload.entity?.title ?? null,
        archivedAt: payload.entity?.archivedAt ?? null,
      };
    },
  });
}
