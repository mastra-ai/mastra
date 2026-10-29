// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listWordDocumentsInputSchema = z.object({
  driveId: z
    .string()
    .describe('Drive ID. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"'),
  query: z
    .string()
    .optional()
    .describe(
      'Search query to filter documents by name. Omit to list documents in the root folder only (not recursive).',
    ),
  cursor: z
    .string()
    .url()
    .optional()
    .describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const ProviderFileSchema = z
  .object({
    mimeType: z.string().nullish(),
    hashes: z
      .object({
        quickXorHash: z.string().nullish(),
      })
      .nullish(),
  })
  .nullish();

const ProviderParentReferenceSchema = z
  .object({
    driveId: z.string().nullish(),
    id: z.string().nullish(),
    path: z.string().nullish(),
  })
  .nullish();

const ProviderDriveItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  webUrl: z.string().nullish(),
  size: z.number().nullish(),
  createdDateTime: z.string().nullish(),
  lastModifiedDateTime: z.string().nullish(),
  file: ProviderFileSchema,
  parentReference: ProviderParentReferenceSchema,
});

const GraphResponseSchema = z.object({
  value: z.array(z.unknown()),
  '@odata.nextLink': z.string().optional(),
});

const DriveItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  webUrl: z.string().optional(),
  size: z.number().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  file: z
    .object({
      mimeType: z.string().optional(),
      hashes: z
        .object({
          quickXorHash: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  parentReference: z
    .object({
      driveId: z.string().optional(),
      id: z.string().optional(),
      path: z.string().optional(),
    })
    .optional(),
});

export const listWordDocumentsOutputSchema = z.object({
  items: z.array(DriveItemSchema),
  nextCursor: z.string().optional(),
});

const WORD_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function listWordDocumentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_word_list_word_documents',
    description: 'List/search .docx files within a drive',
    inputSchema: listWordDocumentsInputSchema,
    outputSchema: listWordDocumentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listWordDocumentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const encodedDriveId = encodeURIComponent(input.driveId);
      const searchEndpointPrefix = `/v1.0/drives/${encodedDriveId}/root/search(`;
      const childrenEndpoint = `/v1.0/drives/${encodedDriveId}/items/root/children`;

      let endpoint: string;
      if (input.cursor) {
        const cursorUrl = new URL(input.cursor);
        if (cursorUrl.pathname !== childrenEndpoint && !cursorUrl.pathname.startsWith(searchEndpointPrefix)) {
          throw new platformProxy.ActionError({
            type: 'invalid_input',
            message: 'cursor must be a nextLink returned by this same action for this driveId',
          });
        }
        endpoint = cursorUrl.pathname + cursorUrl.search;
      } else if (input.query) {
        // https://learn.microsoft.com/en-us/graph/api/driveitem-search
        // Single quotes inside the OData literal must be doubled to escape them, per Graph's search syntax.
        const escapedQuery = input.query.replace(/'/g, "''");
        endpoint = `${searchEndpointPrefix}q='${encodeURIComponent(escapedQuery)}')`;
      } else {
        // https://learn.microsoft.com/en-us/graph/api/driveitem-list-children
        endpoint = childrenEndpoint;
      }

      // https://learn.microsoft.com/en-us/graph/api/resources/driveitem
      const config = {
        endpoint,
        retries: 3,
      };

      const response = await platformProxy.get(config);

      const graphResponse = GraphResponseSchema.parse(response.data);

      const items: z.infer<typeof DriveItemSchema>[] = [];
      for (const rawItem of graphResponse.value) {
        const parsed = ProviderDriveItemSchema.safeParse(rawItem);
        if (!parsed.success || parsed.data.file?.mimeType !== WORD_MIME_TYPE) {
          continue;
        }

        const item = parsed.data;
        items.push({
          id: item.id,
          name: item.name,
          ...(item.webUrl != null && { webUrl: item.webUrl }),
          ...(item.size != null && { size: item.size }),
          ...(item.createdDateTime != null && { createdDateTime: item.createdDateTime }),
          ...(item.lastModifiedDateTime != null && { lastModifiedDateTime: item.lastModifiedDateTime }),
          ...(item.file?.mimeType != null && {
            file: {
              mimeType: item.file.mimeType,
              ...(item.file.hashes?.quickXorHash != null && {
                hashes: { quickXorHash: item.file.hashes.quickXorHash },
              }),
            },
          }),
          ...(item.parentReference != null && {
            parentReference: {
              ...(item.parentReference.driveId != null && { driveId: item.parentReference.driveId }),
              ...(item.parentReference.id != null && { id: item.parentReference.id }),
              ...(item.parentReference.path != null && { path: item.parentReference.path }),
            },
          }),
        });
      }

      return {
        items,
        ...(graphResponse['@odata.nextLink'] !== undefined && { nextCursor: graphResponse['@odata.nextLink'] }),
      };
    },
  });
}
