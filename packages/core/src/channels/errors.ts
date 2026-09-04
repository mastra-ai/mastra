/**
 * Wraps whatever a host's `resolveSession` threw, marking the failure as a
 * refused request rather than a malfunction.
 *
 * The distinction matters at the channel boundary: an internal failure is
 * reported back to the chat thread so the user isn't left waiting, but a
 * refusal must stay silent. Posting it would echo the host's authorization
 * message — install ids, tenant names, why the principal was rejected — into
 * a shared Slack/Discord thread, and would tell an unauthorized sender that
 * the bot is there at all.
 *
 * The original error is preserved as `cause` and its message is kept, so host
 * logs still say exactly why the request was refused.
 */
export class ChannelSessionRejectedError extends Error {
  override readonly name = 'ChannelSessionRejectedError';

  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
  }
}
