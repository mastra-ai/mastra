// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { randomUUID } from 'node:crypto';

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const copyWordDocumentInputSchema = z.object({
  driveId: z
    .string()
    .describe(
      'The ID of the drive containing the source document. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"',
    ),
  itemId: z.string().describe('The ID of the Word document to copy. Example: "01RFYLAYGCHWM67HNJIZBJNCQTFNXT6YGT"'),
  name: z
    .string()
    .optional()
    .describe(
      'Optional new name for the copied document. If omitted and no destination is given, a unique name is generated automatically to avoid overwriting the source.',
    ),
  destinationDriveId: z
    .string()
    .optional()
    .describe(
      'Optional ID of the destination drive. Defaults to the source drive if omitted. If provided without destinationFolderId, the drive root is used.',
    ),
  destinationFolderId: z
    .string()
    .optional()
    .describe(
      'Optional ID of the destination folder. If omitted, the copy is placed in the same folder as the source (or the destination drive root).',
    ),
});

const SourceItemSchema = z.object({
  name: z.string(),
  parentReference: z
    .object({
      id: z.string().nullish(),
    })
    .nullish(),
});

const ProviderDriveItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  webUrl: z.string().optional().nullable(),
  size: z.number().optional().nullable(),
  createdDateTime: z.string().optional().nullable(),
});

export const copyWordDocumentOutputSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  webUrl: z.string().optional(),
  size: z.number().optional(),
  createdDateTime: z.string().optional(),
  location: z
    .string()
    .optional()
    .describe('Polling URL for async copy status when the copy is not completed synchronously.'),
});

const splitNameParts = (fileName: string): { base: string; ext: string } => {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0) {
    return { base: fileName, ext: '' };
  }
  return { base: fileName.slice(0, dotIndex), ext: fileName.slice(dotIndex) };
};

export function copyWordDocumentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_word_copy_word_document',
    description: 'Copy a Word document to a (possibly different) folder, optionally renaming it.',
    inputSchema: copyWordDocumentInputSchema,
    outputSchema: copyWordDocumentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof copyWordDocumentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Copying in place (no explicit name and no explicit destination) would ask Microsoft Graph
      // to create a copy with the exact same name in the exact same folder, which always fails with
      // nameAlreadyExists. We also need the source's name/parent to build a correct result when the
      // provider response comes back empty (see below). That's only required when the name is
      // unknown, or when neither destination field is given and the source's own folder must be
      // resolved as the implicit target — a named copy into an explicit destination (folder or drive
      // root) never needs it.
      const needsSourceLookup =
        input.name === undefined || (input.destinationFolderId === undefined && input.destinationDriveId === undefined);

      let sourceName: string | undefined;
      let sourceParentId: string | undefined;

      if (needsSourceLookup) {
        const sourceResponse = await platformProxy.get({
          // https://learn.microsoft.com/en-us/graph/api/driveitem-get
          endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}`,
          params: { $select: 'name,parentReference' },
          retries: 3,
        });
        const source = SourceItemSchema.parse(sourceResponse.data);
        sourceName = source.name;
        sourceParentId = source.parentReference?.id ?? undefined;
      }

      const isInPlaceCopy = input.destinationFolderId === undefined && input.destinationDriveId === undefined;

      let name = input.name;
      if (name === undefined && isInPlaceCopy) {
        const { base, ext } = splitNameParts(sourceName!);
        // A random suffix guarantees uniqueness even for concurrent/retried in-place copies,
        // unlike a timestamp, which two calls can generate identically.
        name = `${base} - Copy ${randomUUID()}${ext}`;
      }

      const requestBody: Record<string, unknown> = {};

      if (name !== undefined) {
        requestBody['name'] = name;
      }

      if (input.destinationFolderId !== undefined || input.destinationDriveId !== undefined) {
        requestBody['parentReference'] = {
          id: input.destinationFolderId ?? 'root',
          ...(input.destinationDriveId !== undefined && { driveId: input.destinationDriveId }),
        };
      }

      const response = await platformProxy.post({
        // https://learn.microsoft.com/en-us/graph/api/driveitem-copy
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/copy`,
        data: requestBody,
        retries: 1,
      });

      const location = response.headers?.['location'] || response.headers?.['Location'];

      if (response.data && typeof response.data === 'object') {
        const providerItem = ProviderDriveItemSchema.parse(response.data);

        return {
          id: providerItem.id,
          name: providerItem.name,
          ...(providerItem.webUrl != null && { webUrl: providerItem.webUrl }),
          ...(providerItem.size != null && { size: providerItem.size }),
          ...(providerItem.createdDateTime != null && { createdDateTime: providerItem.createdDateTime }),
        };
      }

      if (response.status === 202) {
        // Async copy: Graph is still processing it. Return the monitor URL so the caller can poll
        // it, or an empty result if Graph didn't provide one — never look up the destination item
        // now, since it may not exist yet and the lookup would fail while the copy is still pending.
        return typeof location === 'string' ? { location } : {};
      }

      if (typeof location === 'string') {
        return { location };
      }

      // Graph completed the copy synchronously but returned an empty body (observed in practice even
      // though this endpoint is documented as always returning 202). Look the copied item up by its
      // known destination path instead of reporting an empty, unusable result.
      const finalName = name ?? sourceName!;
      const finalDriveId = input.destinationDriveId ?? input.driveId;
      const finalParentId =
        input.destinationFolderId ?? (input.destinationDriveId !== undefined ? 'root' : sourceParentId);

      if (finalParentId === undefined) {
        return {};
      }

      const lookupResponse = await platformProxy.get({
        // https://learn.microsoft.com/en-us/graph/api/driveitem-get
        endpoint: `/v1.0/drives/${encodeURIComponent(finalDriveId)}/items/${encodeURIComponent(finalParentId)}:/${encodeURIComponent(finalName)}`,
        retries: 3,
      });

      const providerItem = ProviderDriveItemSchema.parse(lookupResponse.data);

      return {
        id: providerItem.id,
        name: providerItem.name,
        ...(providerItem.webUrl != null && { webUrl: providerItem.webUrl }),
        ...(providerItem.size != null && { size: providerItem.size }),
        ...(providerItem.createdDateTime != null && { createdDateTime: providerItem.createdDateTime }),
      };
    },
  });
}
