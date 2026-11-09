// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const addDocumentTabInputSchema = z.object({
  documentId: z
    .string()
    .describe('The ID of the document to add the tab to. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  title: z.string().optional().describe('The user-visible name of the tab.'),
  parentTabId: z
    .string()
    .optional()
    .describe('The ID of the parent tab. Empty when the current tab is a root-level tab.'),
  index: z.number().int().nonnegative().optional().describe('The zero-based index of the tab within the parent.'),
  iconEmoji: z.string().optional().describe('The emoji icon displayed with the tab.'),
});

const ProviderTabPropertiesSchema = z.object({
  tabId: z.string(),
  title: z.string().optional(),
  parentTabId: z.string().optional(),
  index: z.number().int().optional(),
  nestingLevel: z.number().int().optional(),
  iconEmoji: z.string().optional(),
});

const ProviderBatchUpdateResponseSchema = z.object({
  documentId: z.string(),
  replies: z.array(
    z.object({
      addDocumentTab: z
        .object({
          tabProperties: ProviderTabPropertiesSchema,
        })
        .optional(),
    }),
  ),
});

export const addDocumentTabOutputSchema = z.object({
  tabId: z.string(),
  title: z.string().optional(),
  parentTabId: z.string().optional(),
  index: z.number().int().optional(),
  nestingLevel: z.number().int().optional(),
  iconEmoji: z.string().optional(),
});

export function addDocumentTabTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_add_document_tab',
    description: 'Add a new document tab to an existing Google Doc.',
    inputSchema: addDocumentTabInputSchema,
    outputSchema: addDocumentTabOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof addDocumentTabOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const tabProperties: Record<string, unknown> = {};
      if (input.title !== undefined) {
        tabProperties['title'] = input.title;
      }
      if (input.parentTabId !== undefined) {
        tabProperties['parentTabId'] = input.parentTabId;
      }
      if (input.index !== undefined) {
        tabProperties['index'] = input.index;
      }
      if (input.iconEmoji !== undefined) {
        tabProperties['iconEmoji'] = input.iconEmoji;
      }

      // https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/batchUpdate
      const response = await platformProxy.post({
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              addDocumentTab: {
                tabProperties,
              },
            },
          ],
        },
        retries: 3,
      });

      const parsed = ProviderBatchUpdateResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'provider_response_error',
          message: 'Failed to parse the batchUpdate response from the Google Docs API.',
          details: parsed.error.message,
        });
      }

      const reply = parsed.data.replies[0];
      if (!reply || !reply.addDocumentTab || !reply.addDocumentTab.tabProperties) {
        throw new platformProxy.ActionError({
          type: 'provider_response_error',
          message: 'The Google Docs API batchUpdate response did not contain the expected addDocumentTab reply.',
          replies: parsed.data.replies,
        });
      }

      const props = reply.addDocumentTab.tabProperties;

      return {
        tabId: props.tabId,
        ...(props.title !== undefined && { title: props.title }),
        ...(props.parentTabId !== undefined && { parentTabId: props.parentTabId }),
        ...(props.index !== undefined && { index: props.index }),
        ...(props.nestingLevel !== undefined && { nestingLevel: props.nestingLevel }),
        ...(props.iconEmoji !== undefined && { iconEmoji: props.iconEmoji }),
      };
    },
  });
}
