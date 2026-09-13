import type { StateAdapter } from 'chat';

/**
 * Slack mention token, e.g. `<@U123>` or `<@U123|display name>`.
 * Mirrors the adapter's own `SLACK_USER_ID_PATTERN` (`/^[A-Z0-9_]+$/`) rather
 * than a narrower `[UW]`-prefixed form, so ids with underscores still match.
 */
const SLACK_MENTION_TOKEN = /<@([A-Z0-9_]+)(?:\|([^<>]*))?>/g;

/** Shape the Slack adapter caches under `slack:user:${id}`. */
interface CachedSlackUser {
  displayName?: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The raw Slack payload is the event itself, or an envelope around it. */
function rawEventText(raw: unknown): string | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const event = 'event' in raw && typeof raw.event === 'object' && raw.event !== null ? raw.event : raw;
  return 'text' in event && typeof event.text === 'string' ? event.text : undefined;
}

/**
 * Restore mentions in agent-facing text to Slack's native `<@U123|Display Name>`
 * token, so the agent sees who was mentioned and can mention them back.
 *
 * The token is Slack's own inbound wire format, so the agent can copy it
 * verbatim into a reply: the outbound `finalize()` pass walks from `<` to the
 * closing `>` and emits the token untouched (a space in the label does not
 * break it), and Slack renders it as a real mention.
 *
 * Why this has to be restored at all: the adapter resolves `<@U123>` to
 * `<@U123|Display Name>`, but the mrkdwn→markdown conversion then collapses it
 * to a bare `@Display Name`, and the AST has no mention node — so by the time
 * we hold `message.text`/`formatted` the id is gone. `message.raw` still
 * carries the original token, which gives us the ids; the labels come from the
 * adapter's own user cache, populated during that same resolve.
 *
 * Cache reads only, never `getUser()`: a cache hit is a local map read, while a
 * miss would be a `users.info` round trip awaited before the agent is
 * dispatched. Unknown ids are left alone rather than adding latency to every
 * mention-bearing message.
 */
export async function annotateSlackMentions({
  state,
  raw,
  text,
}: {
  state: Pick<StateAdapter, 'get'>;
  raw: unknown;
  text: string;
}): Promise<string> {
  if (!text) return text;

  const rawText = rawEventText(raw);
  if (!rawText) return text;

  const tokens = new Map<string, string | undefined>();
  for (const [, id, pipeLabel] of rawText.matchAll(SLACK_MENTION_TOKEN)) {
    if (!id) continue;
    // A token carrying a label wins over a bare one for the same id.
    if (!tokens.get(id)) tokens.set(id, pipeLabel || undefined);
  }
  if (tokens.size === 0) return text;

  // `@needle` → `<@id|label>`. Two spellings can reach the rendered text:
  // resolved mentions appear as the display name, while the bot's own mention
  // is deliberately left unresolved by the adapter (to keep mention detection
  // working) and so appears as the bare id.
  const replacements = new Map<string, string>();
  await Promise.all(
    [...tokens].map(async ([id, pipeLabel]) => {
      const cached = await state.get<CachedSlackUser>(`slack:user:${id}`);
      const label = cached?.displayName || pipeLabel;
      if (!label) return;
      const token = `<@${id}|${label}>`;
      replacements.set(`@${id}`, token);
      replacements.set(`@${label}`, token);
    }),
  );
  if (replacements.size === 0) return text;

  // Longest needle first so `@Cal` never shadows `@Caleb Barnes`, and a single
  // pass so restored tokens are never rescanned.
  const needles = [...replacements.keys()].sort((a, b) => b.length - a.length).map(escapeRegex);
  return text.replace(new RegExp(needles.join('|'), 'g'), match => replacements.get(match) ?? match);
}
