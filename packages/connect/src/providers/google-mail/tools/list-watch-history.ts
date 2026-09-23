// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listWatchHistoryInputSchema = z.object({
  startHistoryId: z.string().describe('Start history ID to return history records after. Example: "1234567890"'),
  historyTypes: z
    .array(z.enum(['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved']))
    .optional()
    .describe(
      'History types to return. Supported values: messageAdded, messageDeleted, labelAdded, labelRemoved. If not specified, all history types are returned.',
    ),
  labelId: z.string().optional().describe('Only return history for this label. Example: "Label_1"'),
  maxResults: z.number().optional().describe('Maximum number of history records to return.'),
  pageToken: z.string().optional().describe('Page token to retrieve a specific page of results.'),
});

const HistoryMessageAddedSchema = z.object({
  message: z.object({
    id: z.string(),
    threadId: z.string(),
    labelIds: z.array(z.string()).optional(),
    historyId: z.string().optional(),
  }),
});

const HistoryMessageDeletedSchema = z.object({
  message: z.object({
    id: z.string(),
    threadId: z.string(),
    labelIds: z.array(z.string()).optional(),
    historyId: z.string().optional(),
  }),
});

const HistoryLabelAddedSchema = z.object({
  message: z.object({
    id: z.string(),
    threadId: z.string(),
    labelIds: z.array(z.string()).optional(),
  }),
  labelIds: z.array(z.string()),
});

const HistoryLabelRemovedSchema = z.object({
  message: z.object({
    id: z.string(),
    threadId: z.string(),
    labelIds: z.array(z.string()).optional(),
  }),
  labelIds: z.array(z.string()),
});

const HistoryRecordSchema = z.object({
  id: z.string(),
  messages: z
    .array(
      z.object({
        id: z.string(),
        threadId: z.string(),
        labelIds: z.array(z.string()).optional(),
        historyId: z.string().optional(),
      }),
    )
    .optional(),
  messagesAdded: z.array(HistoryMessageAddedSchema).optional(),
  messagesDeleted: z.array(HistoryMessageDeletedSchema).optional(),
  labelsAdded: z.array(HistoryLabelAddedSchema).optional(),
  labelsRemoved: z.array(HistoryLabelRemovedSchema).optional(),
});

const ProviderHistorySchema = z.object({
  history: z.array(HistoryRecordSchema).optional(),
  historyId: z.string().optional(),
  nextPageToken: z.string().optional(),
});

export const listWatchHistoryOutputSchema = z.object({
  history: z.array(
    z.object({
      id: z.string(),
      messages: z
        .array(
          z.object({
            id: z.string(),
            threadId: z.string(),
            labelIds: z.array(z.string()).optional(),
            historyId: z.string().optional(),
          }),
        )
        .optional(),
      messagesAdded: z
        .array(
          z.object({
            message: z.object({
              id: z.string(),
              threadId: z.string(),
              labelIds: z.array(z.string()).optional(),
              historyId: z.string().optional(),
            }),
          }),
        )
        .optional(),
      messagesDeleted: z
        .array(
          z.object({
            message: z.object({
              id: z.string(),
              threadId: z.string(),
              labelIds: z.array(z.string()).optional(),
              historyId: z.string().optional(),
            }),
          }),
        )
        .optional(),
      labelsAdded: z
        .array(
          z.object({
            message: z.object({
              id: z.string(),
              threadId: z.string(),
              labelIds: z.array(z.string()).optional(),
            }),
            labelIds: z.array(z.string()),
          }),
        )
        .optional(),
      labelsRemoved: z
        .array(
          z.object({
            message: z.object({
              id: z.string(),
              threadId: z.string(),
              labelIds: z.array(z.string()).optional(),
            }),
            labelIds: z.array(z.string()),
          }),
        )
        .optional(),
    }),
  ),
  historyId: z.string().optional(),
  nextPageToken: z.string().optional(),
});

function isHistoryNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const status = 'status' in error ? error.status : undefined;
  if (status === 404) {
    return true;
  }
  const payload = 'payload' in error ? error.payload : undefined;
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  const nestedError = 'error' in payload ? payload.error : undefined;
  if (!nestedError || typeof nestedError !== 'object') {
    return false;
  }
  return 'code' in nestedError && nestedError.code === 404;
}

export function listWatchHistoryTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_list_watch_history',
    description: 'List mailbox history records after a given history ID',
    inputSchema: listWatchHistoryInputSchema,
    outputSchema: listWatchHistoryOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listWatchHistoryOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number | string[]> = {
        startHistoryId: input.startHistoryId,
      };

      if (input.historyTypes !== undefined && input.historyTypes.length > 0) {
        params['historyTypes'] = input.historyTypes;
      }

      if (input.labelId !== undefined) {
        params['labelId'] = input.labelId;
      }

      if (input.maxResults !== undefined) {
        params['maxResults'] = input.maxResults;
      }

      if (input.pageToken !== undefined) {
        params['pageToken'] = input.pageToken;
      }

      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list
      let response;
      try {
        response = await platformProxy.get({
          endpoint: '/gmail/v1/users/me/history',
          params,
          retries: 3,
        });
      } catch (error) {
        if (isHistoryNotFoundError(error)) {
          throw new platformProxy.ActionError({
            type: 'not_found',
            message: 'Invalid startHistoryId. The provided history ID was not found.',
            startHistoryId: input.startHistoryId,
          });
        }
        throw error;
      }

      const providerData = ProviderHistorySchema.parse(response.data);

      return {
        history: providerData.history ?? [],
        historyId: providerData.historyId,
        nextPageToken: providerData.nextPageToken,
      };
    },
  });
}
