// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listFilesInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from previous response. Omit for first page.'),
  channel_id: z.string().optional().describe('Channel ID to filter files by channel. Example: "C1234567890"'),
  limit: z.number().optional().describe('Maximum number of files to return per page. Default: 100. Max: 200.'),
});

const FileSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string().optional(),
  url_private: z.string().optional(),
  filetype: z.string(),
  size: z.number(),
  created: z.number(),
  user: z.string(),
  channels: z.array(z.string()).optional(),
});

export const listFilesOutputSchema = z.object({
  files: z.array(FileSchema),
  next_cursor: z.string().optional(),
  total: z.number().optional(),
});

export function listFilesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_list_files',
    description: 'List files shared in the workspace',
    inputSchema: listFilesInputSchema,
    outputSchema: listFilesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listFilesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};

      if (input.cursor) {
        params['cursor'] = input.cursor;
      }
      if (input.channel_id) {
        params['channel'] = input.channel_id;
      }
      if (input.limit) {
        params['limit'] = input.limit;
      }

      // https://api.slack.dev/apis/files/list
      const response = await platformProxy.get({
        endpoint: 'files.list',
        params,
        retries: 3,
      });

      if (!response.data || !response.data.files) {
        return {
          files: [],
          next_cursor: undefined,
          total: 0,
        };
      }

      const files = response.data.files.map(
        (file: {
          id: string;
          name: string;
          title?: string;
          url_private?: string;
          filetype: string;
          size: number;
          created: number;
          user: string;
          channels?: string[];
        }) => ({
          id: file.id,
          name: file.name,
          title: file.title,
          url_private: file.url_private,
          filetype: file.filetype,
          size: file.size,
          created: file.created,
          user: file.user,
          channels: file.channels,
        }),
      );

      return {
        files,
        next_cursor: response.data.paging?.cursor || undefined,
        total: response.data.paging?.total || files.length,
      };
    },
  });
}
