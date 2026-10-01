// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateDocumentTabPropertiesInputSchema = z.object({
  documentId: z.string().describe('Google Docs document ID. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  tabId: z.string().describe('Tab ID to update. Example: "t.0"'),
  title: z.string().optional().describe('New tab title.'),
  parentTabId: z.string().nullable().optional().describe('New parent tab ID. Set to empty string for root-level.'),
  index: z.number().int().optional().describe('New zero-based index within the parent.'),
  iconEmoji: z.string().nullable().optional().describe('Emoji icon for the tab.'),
});

const BatchUpdateResponseSchema = z.object({
  documentId: z.string(),
  replies: z.array(z.unknown()).optional(),
  writeLocation: z.unknown().optional(),
});

export const updateDocumentTabPropertiesOutputSchema = z.object({
  documentId: z.string(),
  tabId: z.string(),
  updatedFields: z.array(z.string()),
});

export function updateDocumentTabPropertiesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_update_document_tab_properties',
    description: 'Rename or move a document tab.',
    inputSchema: updateDocumentTabPropertiesInputSchema,
    outputSchema: updateDocumentTabPropertiesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateDocumentTabPropertiesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const updatedFields: string[] = [];

      const tabProperties: Record<string, unknown> = {
        tabId: input.tabId,
      };

      if (input.title !== undefined) {
        tabProperties['title'] = input.title;
        updatedFields.push('title');
      }

      if (input.parentTabId !== undefined) {
        tabProperties['parentTabId'] = input.parentTabId;
        updatedFields.push('parentTabId');
      }

      if (input.index !== undefined) {
        tabProperties['index'] = input.index;
        updatedFields.push('index');
      }

      if (input.iconEmoji !== undefined) {
        tabProperties['iconEmoji'] = input.iconEmoji;
        updatedFields.push('iconEmoji');
      }

      if (updatedFields.length === 0) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'At least one of title, parentTabId, index, or iconEmoji must be provided.',
        });
      }

      // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
      const response = await platformProxy.post({
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              updateDocumentTabProperties: {
                tabProperties,
                fields: updatedFields.join(','),
              },
            },
          ],
        },
        retries: 3,
      });

      const batchResponse = BatchUpdateResponseSchema.safeParse(response.data);
      if (!batchResponse.success) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Unexpected response from Google Docs API.',
          details: batchResponse.error.message,
        });
      }

      return {
        documentId: input.documentId,
        tabId: input.tabId,
        updatedFields,
      };
    },
  });
}
