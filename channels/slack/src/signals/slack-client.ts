/**
 * Minimal Slack Web API surface used by SlackSignals polling.
 *
 * Kept as an interface so tests (and hosts with their own Slack client) can
 * inject a fake instead of hitting the network.
 */
export type SlackConversationMessage = {
  /** Slack message timestamp (also the message id), e.g. "1725000000.000100". */
  ts: string;
  /** Author user id (absent for some bot/system messages). */
  user?: string;
  /** Set when the message was posted by a bot. */
  botId?: string;
  text?: string;
  /** Parent thread timestamp when the message is a threaded reply. */
  threadTs?: string;
  /** Slack message subtype (e.g. "channel_join"). */
  subtype?: string;
};

export type FetchNewMessagesInput = {
  token: string;
  channelId: string;
  /** When set, poll thread replies; otherwise poll top-level channel history. */
  threadTs?: string;
  /** Exclusive cursor — only messages with ts > oldest are returned. */
  oldest?: string;
  limit?: number;
};

export type SlackSignalsClient = {
  /** Fetch messages newer than `oldest`, sorted oldest-first. */
  fetchNewMessages(input: FetchNewMessagesInput): Promise<SlackConversationMessage[]>;
};

type SlackApiMessage = {
  ts?: string;
  user?: string;
  bot_id?: string;
  text?: string;
  thread_ts?: string;
  subtype?: string;
};

type SlackApiResponse = {
  ok?: boolean;
  error?: string;
  messages?: SlackApiMessage[];
};

const DEFAULT_LIMIT = 50;
const MAX_RETRY_AFTER_MS = 30_000;

/**
 * Default fetch-based client for `conversations.history` / `conversations.replies`.
 * Retries once on 429 honoring `Retry-After` (capped at 30s).
 */
export class FetchSlackSignalsClient implements SlackSignalsClient {
  async fetchNewMessages(input: FetchNewMessagesInput): Promise<SlackConversationMessage[]> {
    const method = input.threadTs ? 'conversations.replies' : 'conversations.history';
    const params = new URLSearchParams({
      channel: input.channelId,
      limit: String(input.limit ?? DEFAULT_LIMIT),
    });
    if (input.threadTs) params.set('ts', input.threadTs);
    if (input.oldest) {
      params.set('oldest', input.oldest);
      params.set('inclusive', 'false');
    }

    const json = await this.#call(method, params, input.token);
    const messages = (json.messages ?? [])
      .filter((message): message is SlackApiMessage & { ts: string } => typeof message.ts === 'string')
      // `oldest` filtering guard: conversations.replies always includes the
      // parent message; drop anything at or before the cursor.
      .filter(message => !input.oldest || compareSlackTs(message.ts, input.oldest) > 0)
      .map(message => ({
        ts: message.ts,
        user: message.user,
        botId: message.bot_id,
        text: message.text,
        threadTs: message.thread_ts,
        subtype: message.subtype,
      }));
    return messages.sort((a, b) => compareSlackTs(a.ts, b.ts));
  }

  async #call(method: string, params: URLSearchParams, token: string, attempt = 0): Promise<SlackApiResponse> {
    const response = await fetch(`https://slack.com/api/${method}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 429 && attempt === 0) {
      const retryAfterSeconds = Number(response.headers.get('retry-after') ?? '1');
      const waitMs = Math.min(Math.max(retryAfterSeconds, 1) * 1000, MAX_RETRY_AFTER_MS);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return this.#call(method, params, token, attempt + 1);
    }

    const json = (await response.json()) as SlackApiResponse;
    if (!json.ok) {
      throw new Error(`Slack API error (${method}): ${json.error ?? `HTTP ${response.status}`}`);
    }
    return json;
  }
}

/** Compare two Slack ts strings numerically (seconds.microseconds). */
export function compareSlackTs(a: string, b: string): number {
  const [aSec = '0', aMicro = '0'] = a.split('.');
  const [bSec = '0', bMicro = '0'] = b.split('.');
  const secDiff = Number(aSec) - Number(bSec);
  if (secDiff !== 0) return secDiff;
  return Number(aMicro.padEnd(6, '0')) - Number(bMicro.padEnd(6, '0'));
}
