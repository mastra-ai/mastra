import { z } from 'zod';

import type { AgentControllerRequestContext } from '../agent-controller/types';
import type { RequestContext } from '../request-context';
import { createTool } from '../tools';
import type { ChatChannelRenderContext } from './output-processor';
import { resolveChannelRenderContext } from './thread-lookup';
import type { ChannelsSource } from './thread-lookup';

export const ATTACH_FILE_TOOL_NAME = 'attach_file';

/** Slack rejects larger uploads well before this; keep the sandbox read bounded too. */
export const ATTACH_FILE_MAX_BYTES = 50 * 1024 * 1024;

export interface ChannelAttachFileOptions {
  /** The channels the run's thread may be linked to, so runs not started in the channel can attach too. */
  channels?: ChannelsSource;
}

/**
 * Uploads need a scope (`files:write` on Slack) that an app created before
 * this tool existed will not have. `@slack/web-api` reports that as a
 * platform error with `data.error === 'missing_scope'` and the scope in
 * `data.needed`; say so plainly instead of surfacing the raw API error, so
 * the model tells the user what to fix rather than retrying.
 */
function missingScopeError(error: unknown, platform: string): Error | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const data = (error as { data?: { error?: unknown; needed?: unknown } }).data;
  if (data?.error !== 'missing_scope') return undefined;
  const needed = typeof data.needed === 'string' && data.needed ? data.needed : 'files:write';
  return new Error(
    `The ${platform} app is missing the \`${needed}\` scope, so it cannot upload files. Add the scope to the app and reinstall it, then try again.`,
  );
}

/** The thread a channel tool posts into, resolved when the tool runs. */
async function postTarget(
  requestContext: RequestContext,
  channels: ChannelsSource | undefined,
): Promise<ChatChannelRenderContext> {
  const render = await resolveChannelRenderContext(requestContext, channels);
  if (!render) throw new Error('This session is no longer linked to a chat thread.');
  return render;
}

/**
 * Lets a channel-triggered run hand a workspace file back to the thread it
 * came from. The agent's reply stream can only carry text, so a report it
 * generated in the sandbox would otherwise be described by path and left
 * there. Offered only on runs whose thread is linked to a chat thread ; the file is read through the session's workspace
 * filesystem so sandbox confinement still applies.
 */
export function createChannelAttachFileTool(requestContext: RequestContext, options: ChannelAttachFileOptions = {}) {
  return {
    [ATTACH_FILE_TOOL_NAME]: createTool({
      id: ATTACH_FILE_TOOL_NAME,
      description:
        'Upload a file from the workspace into this chat thread as an attachment. This is the only way the person you are talking to can receive a file you produced (a report, PDF, export, screenshot, image); they cannot open workspace paths. Call it whenever you have a file to hand over, then describe it briefly in your reply. The attachment posts on its own.',
      inputSchema: z.object({
        path: z.string().min(1).describe('Absolute path of the file inside the workspace'),
      }),
      execute: async ({ path }, context) => {
        const controller = requestContext.get('controller') as AgentControllerRequestContext | undefined;
        const workspace = controller?.workspace ?? context?.workspace;
        const fs = workspace?.filesystem;
        if (!fs) throw new Error('No workspace filesystem is attached to this session.');
        const stat = await fs.stat(path);
        if (stat.type === 'directory') throw new Error(`${path} is a directory; attach a single file.`);
        // The stat check keeps us from reading something enormous; the check on
        // the bytes we actually hold is the one that bounds the upload, since the
        // file can change between the two calls.
        if (stat.size > ATTACH_FILE_MAX_BYTES) {
          throw new Error(`${path} is ${stat.size} bytes; the limit is ${ATTACH_FILE_MAX_BYTES} bytes.`);
        }
        const raw = await fs.readFile(path);
        const data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
        if (data.length > ATTACH_FILE_MAX_BYTES) {
          throw new Error(`${path} is ${data.length} bytes; the limit is ${ATTACH_FILE_MAX_BYTES} bytes.`);
        }
        const filename = path.split('/').pop() || 'file';
        const render = await postTarget(requestContext, options.channels);
        // File only. The Slack adapter posts any non-empty text as a second
        // message after the upload, so a comment would land as its own bubble
        // between the reply and the file; an empty body returns after the upload.
        try {
          await render.chatThread.post({
            markdown: '',
            files: [{ data, filename, ...(stat.mimeType ? { mimeType: stat.mimeType } : {}) }],
          });
        } catch (error) {
          throw missingScopeError(error, render.platform) ?? error;
        }
        return { attached: true, filename, bytes: data.length };
      },
    }),
  };
}
