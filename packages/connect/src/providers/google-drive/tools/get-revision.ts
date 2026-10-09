// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getRevisionInputSchema = z.object({
  fileId: z.string().describe('The ID of the file. Example: "1abc123xyz"'),
  revisionId: z.string().describe('The ID of the revision. Example: "1"'),
});

export const getRevisionOutputSchema = z.object({
  kind: z.string().describe('The type of resource. Always "drive#revision".'),
  id: z.string().describe('The ID of the revision.'),
  mimeType: z.string().describe('The MIME type of the revision.'),
  modifiedTime: z.string().describe('The last time the revision was modified in RFC 3339 format.'),
  keepForever: z.boolean().optional().describe('Whether this revision is marked as keep forever.'),
  published: z.boolean().optional().describe('Whether this revision is published.'),
  publishedLink: z.string().optional().describe('A link to the published revision.'),
  publishedOutsideDomain: z.boolean().optional().describe('Whether this revision is published outside the domain.'),
  size: z.string().optional().describe('The size of the revision in bytes.'),
  originalFilename: z.string().optional().describe('The original filename of the revision.'),
  md5Checksum: z.string().optional().describe('The MD5 checksum of the revision.'),
});

export function getRevisionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_get_revision',
    description: 'Get a file revision by ID',
    inputSchema: getRevisionInputSchema,
    outputSchema: getRevisionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getRevisionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/get
      const response = await platformProxy.get({
        endpoint: `/drive/v3/files/${input.fileId}/revisions/${input.revisionId}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Revision not found',
          fileId: input.fileId,
          revisionId: input.revisionId,
        });
      }

      return {
        kind: response.data.kind,
        id: response.data.id,
        mimeType: response.data.mimeType,
        modifiedTime: response.data.modifiedTime,
        keepForever: response.data.keepForever,
        published: response.data.published,
        publishedLink: response.data.publishedLink,
        publishedOutsideDomain: response.data.publishedOutsideDomain,
        size: response.data.size,
        originalFilename: response.data.originalFilename,
        md5Checksum: response.data.md5Checksum,
      };
    },
  });
}
