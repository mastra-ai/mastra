// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listRevisionsInputSchema = z.object({
  documentId: z.string().describe('Google Docs document ID. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  pageToken: z.string().optional().describe('Pagination token from the previous response. Omit for the first page.'),
});

const LastModifyingUserSchema = z.object({
  kind: z.string().optional(),
  displayName: z.string().optional(),
  photoLink: z.string().optional(),
  me: z.boolean().optional(),
  permissionId: z.string().optional(),
  emailAddress: z.string().optional(),
});

const RevisionSchema = z.object({
  id: z.string(),
  modifiedTime: z.string().optional(),
  lastModifyingUser: LastModifyingUserSchema.optional(),
  keepForever: z.boolean().optional(),
  published: z.boolean().optional(),
});

export const listRevisionsOutputSchema = z.object({
  revisions: z.array(RevisionSchema),
  nextPageToken: z.string().optional(),
});

const DriveRevisionsResponseSchema = z.object({
  nextPageToken: z.string().optional(),
  revisions: z.array(z.unknown()).optional(),
});

export function listRevisionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_list_revisions',
    description: 'List the revision history for a Google Doc.',
    inputSchema: listRevisionsInputSchema,
    outputSchema: listRevisionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listRevisionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/list
      const response = await platformProxy.get({
        endpoint: `/drive/v3/files/${encodeURIComponent(input.documentId)}/revisions`,
        params: {
          fields: 'nextPageToken,revisions(id,modifiedTime,lastModifyingUser,keepForever,published)',
          pageSize: '100',
          ...(input.pageToken !== undefined && { pageToken: input.pageToken }),
        },
        baseUrlOverride: 'https://www.googleapis.com',
        retries: 3,
      });

      const parsedResponse = DriveRevisionsResponseSchema.safeParse(response.data);
      if (!parsedResponse.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Google Drive API',
        });
      }

      const rawRevisions = parsedResponse.data.revisions ?? [];
      const revisions = [];
      for (const rawRevision of rawRevisions) {
        const parsedRevision = RevisionSchema.safeParse(rawRevision);
        if (parsedRevision.success) {
          revisions.push(parsedRevision.data);
        }
      }

      return {
        revisions,
        ...(parsedResponse.data.nextPageToken !== undefined && { nextPageToken: parsedResponse.data.nextPageToken }),
      };
    },
  });
}
