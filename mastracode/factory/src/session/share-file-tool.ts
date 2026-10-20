import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from '@mastra/core/channels';
import type { ChatChannelRenderContext } from '@mastra/core/channels';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../integrations/base.js';

/** Slack rejects larger uploads well before this; keep the sandbox read bounded too. */
export const SHARE_FILE_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Lets a channel-triggered run hand a workspace file back to the thread it
 * came from. The agent's reply stream can only carry text, so a report it
 * generated in the sandbox would otherwise be described by path and left
 * there. Only offered when the run has a chat thread to post to; the file is
 * read through the session's workspace filesystem so sandbox confinement
 * still applies.
 */
export function createShareFileTool(requestContext: RequestContext): IntegrationTools {
  const render = requestContext.get(CHAT_CHANNEL_RENDER_CONTEXT_KEY) as ChatChannelRenderContext | undefined;
  if (!render) return {};
  return {
    share_file: createTool({
      id: 'share_file',
      description:
        'Attach a file from the workspace to the current chat thread. Use this to deliver anything you generated (reports, exports, images) instead of describing where it is on disk. The file posts on its own; say what it is in your reply.',
      inputSchema: z.object({
        path: z.string().min(1).describe('Absolute path of the file inside the workspace'),
      }),
      execute: async ({ path }, context) => {
        const controller = requestContext.get('controller') as AgentControllerRequestContext | undefined;
        const workspace = controller?.workspace ?? context?.workspace;
        const fs = workspace?.filesystem;
        if (!fs) throw new Error('No workspace filesystem is attached to this session.');
        const stat = await fs.stat(path);
        if (stat.type === 'directory') throw new Error(`${path} is a directory; share a single file.`);
        // The stat check keeps us from reading something enormous; the check on
        // the bytes we actually hold is the one that bounds the upload, since the
        // file can change between the two calls.
        if (stat.size > SHARE_FILE_MAX_BYTES) {
          throw new Error(`${path} is ${stat.size} bytes; the limit is ${SHARE_FILE_MAX_BYTES} bytes.`);
        }
        const raw = await fs.readFile(path);
        const data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
        if (data.length > SHARE_FILE_MAX_BYTES) {
          throw new Error(`${path} is ${data.length} bytes; the limit is ${SHARE_FILE_MAX_BYTES} bytes.`);
        }
        const filename = path.split('/').pop() || 'file';
        // File only. The Slack adapter posts any non-empty text as a second
        // message after the upload, so a comment would land as its own bubble
        // between the reply and the file; an empty body returns after the upload.
        await render.chatThread.post({
          markdown: '',
          files: [{ data, filename, ...(stat.mimeType ? { mimeType: stat.mimeType } : {}) }],
        });
        return { shared: true, filename, bytes: data.length };
      },
    }),
  };
}
