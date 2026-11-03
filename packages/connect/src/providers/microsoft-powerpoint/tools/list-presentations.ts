// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listPresentationsInputSchema = z.object({
  drive_id: z
    .string()
    .describe('Drive ID. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"'),
  query: z
    .string()
    .optional()
    .describe('Search query string. Omit to list presentations in the root folder of the drive.'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const ProviderFileSchema = z
  .object({
    mimeType: z.string().optional(),
    hashes: z
      .object({
        quickXorHash: z.string().optional(),
      })
      .optional(),
  })
  .optional()
  .nullable();

const ProviderParentReferenceSchema = z
  .object({
    driveId: z.string().optional(),
    id: z.string().optional(),
    path: z.string().optional(),
  })
  .optional()
  .nullable();

const ProviderDriveItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number().optional(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  file: ProviderFileSchema,
  parentReference: ProviderParentReferenceSchema,
});

const PresentationSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number().optional(),
  web_url: z.string().optional(),
  created_date_time: z.string().optional(),
  last_modified_date_time: z.string().optional(),
  mime_type: z.string().optional(),
  drive_id: z.string().optional(),
  parent_id: z.string().optional(),
  path: z.string().optional(),
});

export const listPresentationsOutputSchema = z.object({
  items: z.array(PresentationSchema),
  next_cursor: z.string().optional(),
});

export function listPresentationsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_powerpoint_list_presentations',
    description: 'List/search .pptx files within a drive',
    inputSchema: listPresentationsInputSchema,
    outputSchema: listPresentationsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPresentationsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      let endpoint: string;
      if (input.cursor) {
        const match = input.cursor.match(/^https:\/\/graph\.microsoft\.com\/v1\.0\/(.+)$/);
        if (!match || !match[1]) {
          throw new platformProxy.ActionError({
            type: 'invalid_cursor',
            message: 'Invalid pagination cursor. Expected a Microsoft Graph @odata.nextLink URL.',
          });
        }
        endpoint = match[1];
      } else if (input.query) {
        const escapedQuery = input.query.replace(/'/g, "''");
        endpoint = `v1.0/drives/${encodeURIComponent(input.drive_id)}/root/search(q='${encodeURIComponent(escapedQuery)}')`;
      } else {
        endpoint = `v1.0/drives/${encodeURIComponent(input.drive_id)}/root/children`;
      }

      const response = await platformProxy.get({
        // https://learn.microsoft.com/en-us/graph/api/driveitem-search
        endpoint,
        params: {
          $select: 'id,name,size,webUrl,createdDateTime,lastModifiedDateTime,file,parentReference',
        },
        retries: 3,
      });

      const rawData = z
        .object({
          value: z.array(z.unknown()),
          '@odata.nextLink': z.string().optional(),
        })
        .parse(response.data);

      const presentations = [];
      for (const item of rawData.value) {
        const parsed = ProviderDriveItemSchema.safeParse(item);
        if (!parsed.success) {
          continue;
        }
        const driveItem = parsed.data;
        const mimeType = driveItem.file?.mimeType;
        if (mimeType !== 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
          continue;
        }
        presentations.push({
          id: driveItem.id,
          name: driveItem.name,
          ...(driveItem.size !== undefined && { size: driveItem.size }),
          ...(driveItem.webUrl !== undefined && { web_url: driveItem.webUrl }),
          ...(driveItem.createdDateTime !== undefined && { created_date_time: driveItem.createdDateTime }),
          ...(driveItem.lastModifiedDateTime !== undefined && {
            last_modified_date_time: driveItem.lastModifiedDateTime,
          }),
          ...(mimeType !== undefined && { mime_type: mimeType }),
          ...(driveItem.parentReference?.driveId !== undefined && { drive_id: driveItem.parentReference.driveId }),
          ...(driveItem.parentReference?.id !== undefined && { parent_id: driveItem.parentReference.id }),
          ...(driveItem.parentReference?.path !== undefined && { path: driveItem.parentReference.path }),
        });
      }

      return {
        items: presentations,
        ...(rawData['@odata.nextLink'] !== undefined && { next_cursor: rawData['@odata.nextLink'] }),
      };
    },
  });
}
