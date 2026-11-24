// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

export const getAttachmentInputSchema = z.object({
  id: z.string().describe('Attachment ID. Example: "123456"'),
  includeLabels: z.boolean().optional().describe('Include labels in the response'),
  includeProperties: z.boolean().optional().describe('Include content properties in the response'),
  includeVersions: z.boolean().optional().describe('Include versions in the response'),
  includeCollaborators: z.boolean().optional().describe('Include collaborators in the response'),
});

const VersionSchema = z.object({
  createdAt: z.string().optional(),
  message: z.string().optional(),
  number: z.number().optional(),
  minorEdit: z.boolean().optional(),
  authorId: z.string().optional(),
});

const LabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string().optional(),
});

const PropertySchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.unknown().optional(),
  version: z.unknown().optional(),
});

const OperationSchema = z.object({
  operation: z.string(),
  targetType: z.string().optional(),
});

const AttachmentSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  title: z.string().optional(),
  createdAt: z.string().optional(),
  pageId: z.string().optional(),
  blogPostId: z.string().optional(),
  customContentId: z.string().optional(),
  mediaType: z.string().optional(),
  mediaTypeDescription: z.string().nullable().optional(),
  comment: z.string().optional(),
  fileId: z.string().optional(),
  fileSize: z.number().optional(),
  webuiLink: z.string().optional(),
  downloadLink: z.string().optional(),
  version: VersionSchema.optional(),
  labels: z
    .object({
      results: z.array(LabelSchema).optional(),
      meta: z
        .object({
          hasMore: z.boolean().optional(),
          cursor: z.string().optional(),
        })
        .optional(),
      _links: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  properties: z
    .object({
      results: z.array(PropertySchema).optional(),
      meta: z
        .object({
          hasMore: z.boolean().optional(),
          cursor: z.string().optional(),
        })
        .optional(),
      _links: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  operations: z
    .object({
      results: z.array(OperationSchema).optional(),
      meta: z
        .object({
          hasMore: z.boolean().optional(),
          cursor: z.string().optional(),
        })
        .optional(),
      _links: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  versions: z
    .object({
      results: z.array(VersionSchema).optional(),
      meta: z
        .object({
          hasMore: z.boolean().optional(),
          cursor: z.string().optional(),
        })
        .optional(),
      _links: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  _links: z.record(z.string(), z.unknown()).optional(),
});

export const getAttachmentOutputSchema = AttachmentSchema;

export function getAttachmentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_get_attachment',
    description: 'Retrieve a Confluence attachment by id.',
    inputSchema: getAttachmentInputSchema,
    outputSchema: getAttachmentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getAttachmentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      let cloudId = connection.connection_config?.['cloudId'];

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        const parsedMetadata = MetadataSchema.safeParse(metadata);
        if (parsedMetadata.success) {
          cloudId = parsedMetadata.data.cloudId;
        }
      }

      if (!cloudId) {
        // https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/#how-to-get-a-list-of-sites
        const resourcesResponse = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resourcesArray = z.array(z.object({ id: z.string() })).safeParse(resourcesResponse.data);
        if (!resourcesArray.success || resourcesArray.data.length === 0) {
          throw new platformProxy.ActionError({
            type: 'missing_cloud_id',
            message: 'Unable to resolve Confluence cloudId from accessible-resources endpoint.',
          });
        }
        if (resourcesArray.data.length > 1) {
          throw new platformProxy.ActionError({
            type: 'ambiguous_cloud_id',
            message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
          });
        }
        cloudId = resourcesArray.data[0]!.id;

        await platformProxy.updateMetadata({ cloudId: cloudId });
      }

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-attachment/#api-attachments-id-get
      const response = await platformProxy.get({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/attachments/${encodeURIComponent(input.id)}`,
        params: {
          ...(input.includeLabels !== undefined && { 'include-labels': String(input.includeLabels) }),
          ...(input.includeProperties !== undefined && { 'include-properties': String(input.includeProperties) }),
          ...(input.includeVersions !== undefined && { 'include-versions': String(input.includeVersions) }),
          ...(input.includeCollaborators !== undefined && {
            'include-collaborators': String(input.includeCollaborators),
          }),
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Attachment with id ${input.id} not found.`,
        });
      }

      return AttachmentSchema.parse(response.data);
    },
  });
}
