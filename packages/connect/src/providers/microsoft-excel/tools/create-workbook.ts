// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createWorkbookInputSchema = z.object({
  driveId: z
    .string()
    .describe('Drive ID. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"'),
  filename: z.string().describe('Filename including .xlsx extension. Example: "workbook.xlsx"'),
  parentId: z.string().optional().describe('Parent folder item ID. If omitted, uploads to the drive root.'),
  contentBase64: z.string().describe('Base64-encoded .xlsx file content.'),
  conflictBehavior: z
    .enum(['fail', 'replace', 'rename'])
    .optional()
    .describe(
      'Behavior when a file with this name already exists at the destination. Defaults to "fail" to avoid silently overwriting an existing workbook.',
    ),
});

const MAX_SIMPLE_UPLOAD_BYTES = 250 * 1024 * 1024;

const ProviderDriveItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  webUrl: z.string().optional(),
  size: z.number().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
});

export const createWorkbookOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  webUrl: z.string().optional(),
  size: z.number().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
});

export function createWorkbookTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_create_workbook',
    description: 'Upload a new .xlsx workbook to a drive folder.',
    inputSchema: createWorkbookInputSchema,
    outputSchema: createWorkbookOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createWorkbookOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const fileBuffer = Buffer.from(input.contentBase64, 'base64');

      if (fileBuffer.byteLength > MAX_SIMPLE_UPLOAD_BYTES) {
        throw new platformProxy.ActionError({
          type: 'file_too_large',
          message: `Workbook content is ${fileBuffer.byteLength} bytes, which exceeds the 250 MB limit supported by this upload method.`,
          driveId: input.driveId,
          filename: input.filename,
        });
      }

      const endpoint = input.parentId
        ? `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.parentId)}:/${encodeURIComponent(input.filename)}:/content`
        : `/v1.0/drives/${encodeURIComponent(input.driveId)}/root:/${encodeURIComponent(input.filename)}:/content`;

      // https://learn.microsoft.com/en-us/graph/api/driveitem-put-content
      const response = await platformProxy.put({
        endpoint,
        params: {
          '@microsoft.graph.conflictBehavior': input.conflictBehavior ?? 'fail',
        },
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        data: fileBuffer,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'upload_failed',
          message: 'Failed to upload workbook - no response data received',
        });
      }

      const providerDriveItem = ProviderDriveItemSchema.parse(response.data);

      return {
        id: providerDriveItem.id,
        name: providerDriveItem.name,
        ...(providerDriveItem.webUrl != null && { webUrl: providerDriveItem.webUrl }),
        ...(providerDriveItem.size != null && { size: providerDriveItem.size }),
        ...(providerDriveItem.createdDateTime != null && { createdDateTime: providerDriveItem.createdDateTime }),
        ...(providerDriveItem.lastModifiedDateTime != null && {
          lastModifiedDateTime: providerDriveItem.lastModifiedDateTime,
        }),
      };
    },
  });
}
