import type { Thread } from 'chat';

import type { RequestContext } from '../request-context';
import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from './output-processor';
import type { ChatChannelRenderContext } from './output-processor';

/** What a tool can know about the channel run it executes in. */
export interface ChannelRun {
  /** The adapter's platform name, e.g. `'slack'`. */
  platform: string;
  /** The Chat SDK thread the run answers in, for e.g. `thread.postEphemeral()`. */
  thread: Thread;
  /** The author of the message that started the run, or the user who clicked the button that resumed it. */
  actor?: { userId: string; userName?: string; fullName?: string };
  /**
   * `actor`'s resource ID: `resolveResourceId` applied to them, or `${platform}:${userId}` without that hook.
   * Always set on a resume click. On an inbound message it is unknown when a `resolveResourceId` hook is
   * configured and the message continues an existing thread, since the hook only runs for new threads.
   */
  actorResourceId?: string;
}

/**
 * The channel run a tool executes in, read from its `requestContext`. Undefined
 * when the run did not come from a channel message or a channel button click.
 *
 * @example
 * ```ts
 * execute: async (input, context) => {
 *   const run = getChannelRun(context.requestContext);
 *   if (run?.actor) await run.thread.postEphemeral(run.actor.userId, 'Only you can see this', { fallbackToDM: true });
 * }
 * ```
 */
export function getChannelRun(requestContext: RequestContext | undefined): ChannelRun | undefined {
  const render = requestContext?.get(CHAT_CHANNEL_RENDER_CONTEXT_KEY) as ChatChannelRenderContext | undefined;
  if (!render?.chatThread) return undefined;
  return {
    platform: render.platform,
    thread: render.chatThread,
    ...(render.actor ? { actor: render.actor } : {}),
    ...(render.actorResourceId !== undefined ? { actorResourceId: render.actorResourceId } : {}),
  };
}
