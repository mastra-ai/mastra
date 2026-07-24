import type { Adapter, Message } from 'chat';

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

/**
 * Extract the Slack team/workspace id (e.g. `T0123`) from an inbound message.
 *
 * The normalized `chat` `Thread`/`Message`/`Author` do not carry the team id —
 * it only survives on `message.raw`, the untyped Slack Events API envelope
 * (`team_id` at the top level; `team`/`team.id` on some event bodies). We read
 * it here duck-typed rather than importing `@mastra/slack` types into core.
 *
 * Returns `null` for non-Slack platforms or when the raw payload lacks a team id.
 */
export function resolveSlackTeamId(params: { platform: string; message: Message }): string | null {
  const { platform, message } = params;
  if (platform !== 'slack') return null;
  const raw = message.raw as { team_id?: unknown; team?: unknown } | undefined;
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.team_id === 'string' && raw.team_id) return raw.team_id;
  if (typeof raw.team === 'string' && raw.team) return raw.team;
  if (raw.team && typeof raw.team === 'object') {
    const teamId = (raw.team as { id?: unknown }).id;
    if (typeof teamId === 'string' && teamId) return teamId;
  }
  return null;
}
