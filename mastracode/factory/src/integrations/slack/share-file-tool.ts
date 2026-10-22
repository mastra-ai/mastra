import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from '@mastra/core/channels';
import type { AgentChannels, ChatChannelRenderContext } from '@mastra/core/channels';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../base.js';

/** Slack rejects larger uploads well before this; keep the sandbox read bounded too. */
export const SHARE_FILE_MAX_BYTES = 50 * 1024 * 1024;

export interface ShareFileToolDeps {
  /**
   * The channels attached to the controller, used to rebuild the chat thread
   * for runs that did not start from a platform message. Omit when the caller
   * has no controller; the tool is then offered only on inbound-webhook runs.
   */
  channels?: () => AgentChannels | null | undefined;
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

/**
 * The chat thread this run replies into, if any.
 *
 * Inbound platform messages stash the render context on `requestContext`.
 * A run woken by a signal (a subagent finishing, a scheduled fire) has no
 * such entry even though its thread is still channel-backed — and that is
 * exactly the run that ends a long job with a file to hand back. Rebuild the
 * context from the thread's persisted channel coordinates the same way
 * `ChatChannelOutputProcessor` does, so the tools post on both kinds of run.
 * A forked subagent's thread carries no channel metadata, so forks get
 * nothing here and never post to the platform.
 */
export async function resolveRenderContext(
  requestContext: RequestContext,
  deps: ShareFileToolDeps,
): Promise<ChatChannelRenderContext | undefined> {
  const stashed = requestContext.get(CHAT_CHANNEL_RENDER_CONTEXT_KEY) as ChatChannelRenderContext | undefined;
  if (stashed) return stashed;
  const controller = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  const threadId = controller?.threadId;
  if (!threadId) return undefined;
  return (await deps.channels?.()?.buildRenderContextForThread(threadId)) ?? undefined;
}

/**
 * Whether this run's thread is a Slack thread, so the channel tools have
 * somewhere to post. A run started from Slack says so on `requestContext`; a
 * web prompt or a woken run on a Slack-linked session costs one thread read.
 * Plain web sessions get `false` and no channel tools.
 */
export async function isSlackThread(requestContext: RequestContext, deps: ShareFileToolDeps): Promise<boolean> {
  const channel = requestContext.get('channel') as { platform?: string } | undefined;
  if (channel) return channel.platform === 'slack';
  const controller = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  const threadId = controller?.threadId;
  if (!threadId) return false;
  const linked = await deps.channels?.()?.buildChannelContextForThread(threadId);
  return linked?.channel.platform === 'slack';
}

/** The thread a channel tool posts into, resolved when the tool runs. */
export async function postTarget(
  requestContext: RequestContext,
  deps: ShareFileToolDeps,
): Promise<ChatChannelRenderContext> {
  const render = await resolveRenderContext(requestContext, deps);
  if (!render) throw new Error('This session is no longer linked to a chat thread.');
  return render;
}

/**
 * Lets a channel-triggered run hand a workspace file back to the thread it
 * came from. The agent's reply stream can only carry text, so a report it
 * generated in the sandbox would otherwise be described by path and left
 * there. Offered only on runs whose thread is linked to a chat thread (see
 * `isSlackThread`); the file is read through the session's workspace
 * filesystem so sandbox confinement still applies.
 */
export function createShareFileTool(requestContext: RequestContext, deps: ShareFileToolDeps = {}): IntegrationTools {
  return {
    attach_file: createTool({
      id: 'attach_file',
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
        if (stat.size > SHARE_FILE_MAX_BYTES) {
          throw new Error(`${path} is ${stat.size} bytes; the limit is ${SHARE_FILE_MAX_BYTES} bytes.`);
        }
        const raw = await fs.readFile(path);
        const data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
        if (data.length > SHARE_FILE_MAX_BYTES) {
          throw new Error(`${path} is ${data.length} bytes; the limit is ${SHARE_FILE_MAX_BYTES} bytes.`);
        }
        const filename = path.split('/').pop() || 'file';
        const render = await postTarget(requestContext, deps);
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
