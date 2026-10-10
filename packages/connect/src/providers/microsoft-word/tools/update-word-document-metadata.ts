// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateWordDocumentMetadataInputSchema = z.object({
  driveId: z
    .string()
    .describe(
      'The ID of the drive containing the document. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"',
    ),
  itemId: z.string().describe('The ID of the driveItem (Word document). Example: "01RFYLAYGCHWM67HNJIZBJNCQTFNXT6YGT"'),
  name: z.string().optional().describe('The new name for the document. Example: "updated-name.docx"'),
  description: z.string().nullable().optional().describe('The new description for the document. Pass null to clear.'),
});

const ParentReferenceSchema = z.object({
  driveId: z.string().optional(),
  id: z.string().optional(),
  path: z.string().optional(),
});

const FileSchema = z.object({
  mimeType: z.string().optional(),
  hashes: z
    .object({
      quickXorHash: z.string().optional(),
    })
    .optional(),
});

const ProviderDriveItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  webUrl: z.string().optional(),
  size: z.number().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  parentReference: ParentReferenceSchema.optional(),
  file: FileSchema.optional(),
});

export const updateWordDocumentMetadataOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  webUrl: z.string().optional(),
  size: z.number().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  parentReference: z
    .object({
      driveId: z.string().optional(),
      id: z.string().optional(),
      path: z.string().optional(),
    })
    .optional(),
  file: z
    .object({
      mimeType: z.string().optional(),
    })
    .optional(),
});

export function updateWordDocumentMetadataTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_word_update_word_document_metadata',
    description: 'Rename a Word document or update its description, without touching content.',
    inputSchema: updateWordDocumentMetadataInputSchema,
    outputSchema: updateWordDocumentMetadataOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateWordDocumentMetadataOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if (input.name === undefined && input.description === undefined) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'At least one of name or description must be provided.',
        });
      }

      const body: Record<string, unknown> = {};
      if (input.name !== undefined) {
        body['name'] = input.name;
      }
      if (input.description !== undefined) {
        body['description'] = input.description;
      }

      // https://learn.microsoft.com/en-us/graph/api/driveitem-update
      const response = await platformProxy.patch({
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}`,
        data: body,
        retries: 3,
      });

      const providerItem = ProviderDriveItemSchema.parse(response.data);

      return {
        id: providerItem.id,
        name: providerItem.name,
        ...(providerItem.description != null && { description: providerItem.description }),
        ...(providerItem.webUrl !== undefined && { webUrl: providerItem.webUrl }),
        ...(providerItem.size !== undefined && { size: providerItem.size }),
        ...(providerItem.createdDateTime !== undefined && { createdDateTime: providerItem.createdDateTime }),
        ...(providerItem.lastModifiedDateTime !== undefined && {
          lastModifiedDateTime: providerItem.lastModifiedDateTime,
        }),
        ...(providerItem.parentReference !== undefined && {
          parentReference: {
            ...(providerItem.parentReference.driveId !== undefined && {
              driveId: providerItem.parentReference.driveId,
            }),
            ...(providerItem.parentReference.id !== undefined && { id: providerItem.parentReference.id }),
            ...(providerItem.parentReference.path !== undefined && { path: providerItem.parentReference.path }),
          },
        }),
        ...(providerItem.file !== undefined && {
          file: {
            ...(providerItem.file.mimeType !== undefined && { mimeType: providerItem.file.mimeType }),
          },
        }),
      };
    },
  });
}
