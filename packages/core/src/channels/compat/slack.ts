import type { Adapter } from 'chat';

/**
 * Duck-typed shape of the Slack adapter's thread-id codec. We avoid importing
 * `@mastra/slack` from core (would create a cycle) and instead check at runtime
 * whether the adapter exposes the encode/decode pair we need.
 */
type SlackThreadIdCodec = {
  decodeThreadId: (id: string) => { channel: string; threadTs: string };
  encodeThreadId: (data: { channel: string; threadTs: string }) => string;
};

function hasSlackThreadIdCodec(adapter: Adapter<any, any>): adapter is Adapter<any, any> & SlackThreadIdCodec {
  const a = adapter as unknown as Partial<SlackThreadIdCodec>;
  return typeof a.decodeThreadId === 'function' && typeof a.encodeThreadId === 'function';
}

/**
 * Slack-specific workaround for tool-approval clicks at the top level of a
 * conversation (DM root or channel root, not inside a thread).
 *
 * The slack adapter's `handleBlockActions` falls back to `messageTs` when the
 * clicked card has no `thread_ts`, which makes the action's `chatThread.id`
 * point at a "thread keyed by the card itself" rather than the top-level
 * conversation the user was actually in. That breaks the `pendingToolApprovals`
 * metadata lookup because the metadata was persisted against the top-level
 * thread.
 *
 * This helper detects that case (decoded `threadTs === messageId`) and rewrites
 * the external thread id to the top-level (empty `threadTs`) form so the
 * approval lookup hits the right mastra thread.
 *
 * Returns `null` when the workaround does not apply (non-slack platform,
 * adapter without the thread-id codec, missing `messageId`, or the click was
 * inside an actual thread). Callers should fall back to the original
 * `chatThread.id` in that case.
 *
 * Remove this compat layer when the slack adapter is fixed to surface the
 * top-level thread id directly on `event.thread`.
 */
export function resolveSlackTopLevelThreadId(params: {
  platform: string;
  adapter: Adapter<any, any>;
  chatThreadId: string;
  messageId?: string;
}): string | null {
  const { platform, adapter, chatThreadId, messageId } = params;
  if (platform !== 'slack' || !messageId) return null;
  if (!hasSlackThreadIdCodec(adapter)) return null;
  const decoded = adapter.decodeThreadId(chatThreadId);
  if (decoded.threadTs !== messageId) return null;
  return adapter.encodeThreadId({ channel: decoded.channel, threadTs: '' });
}
