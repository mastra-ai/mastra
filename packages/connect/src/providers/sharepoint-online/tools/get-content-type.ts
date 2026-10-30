// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getContentTypeInputSchema = z.object({
  siteId: z
    .string()
    .describe(
      'The unique identifier of the SharePoint site. Example: "contoso.sharepoint.com,12345678-1234-1234-1234-123456789012"',
    ),
  contentTypeId: z.string().describe('The unique identifier of the content type. Example: "0x0101"'),
});

const ContentTypeOrderSchema = z.object({
  default: z.boolean().optional(),
  position: z.number().optional(),
});

const ItemReferenceSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    path: z.string().optional(),
    shareId: z.string().optional(),
    sharepointIds: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const ColumnDefinitionSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    displayName: z.string().optional(),
    description: z.string().optional(),
    columnGroup: z.string().optional(),
    type: z.string().optional(),
    hidden: z.boolean().optional(),
    indexed: z.boolean().optional(),
    required: z.boolean().optional(),
    readOnly: z.boolean().optional(),
    enforceUniqueValues: z.boolean().optional(),
    isDeletable: z.boolean().optional(),
    isReorderable: z.boolean().optional(),
    isSealed: z.boolean().optional(),
    propagateChanges: z.boolean().optional(),
    text: z.record(z.string(), z.unknown()).optional(),
    number: z.record(z.string(), z.unknown()).optional(),
    dateTime: z.record(z.string(), z.unknown()).optional(),
    boolean: z.record(z.string(), z.unknown()).optional(),
    choice: z.record(z.string(), z.unknown()).optional(),
    lookup: z.record(z.string(), z.unknown()).optional(),
    personOrGroup: z.record(z.string(), z.unknown()).optional(),
    currency: z.record(z.string(), z.unknown()).optional(),
    calculated: z.record(z.string(), z.unknown()).optional(),
    hyperlinkOrPicture: z.record(z.string(), z.unknown()).optional(),
    term: z.record(z.string(), z.unknown()).optional(),
    thumbnail: z.record(z.string(), z.unknown()).optional(),
    geolocation: z.record(z.string(), z.unknown()).optional(),
    contentApprovalStatus: z.record(z.string(), z.unknown()).optional(),
    defaultValue: z.record(z.string(), z.unknown()).optional(),
    validation: z.record(z.string(), z.unknown()).optional(),
    sourceContentType: z.record(z.string(), z.unknown()).optional(),
    sourceColumn: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const BaseContentTypeSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    group: z.string().optional(),
  })
  .passthrough();

const ContentTypeSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    group: z.string().optional(),
    hidden: z.boolean().optional(),
    isBuiltIn: z.boolean().optional(),
    readOnly: z.boolean().optional(),
    sealed: z.boolean().optional(),
    propagateChanges: z.boolean().optional(),
    parentId: z.string().optional(),
    associatedHubsUrls: z.array(z.string()).optional(),
    order: ContentTypeOrderSchema.optional(),
    inheritedFrom: ItemReferenceSchema.optional(),
    base: BaseContentTypeSchema.optional(),
    baseTypes: z.array(BaseContentTypeSchema).optional(),
    columns: z.array(ColumnDefinitionSchema).optional(),
    columnLinks: z.array(z.record(z.string(), z.unknown())).optional(),
    columnPositions: z.array(ColumnDefinitionSchema).optional(),
  })
  .passthrough();

export const getContentTypeOutputSchema = ContentTypeSchema;

export function getContentTypeTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_get_content_type',
    description: 'Retrieve a single content type from a SharePoint site.',
    inputSchema: getContentTypeInputSchema,
    outputSchema: getContentTypeOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getContentTypeOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://learn.microsoft.com/graph/api/contenttype-get
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/contentTypes/${encodeURIComponent(input.contentTypeId)}`,
        params: {
          $expand: 'columns,base',
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Content type not found',
          siteId: input.siteId,
          contentTypeId: input.contentTypeId,
        });
      }

      const contentType = ContentTypeSchema.parse(response.data);
      return contentType;
    },
  });
}
