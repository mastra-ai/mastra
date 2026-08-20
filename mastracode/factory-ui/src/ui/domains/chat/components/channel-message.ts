/**
 * A channel message reaches the agent written for the model: the thread history
 * it missed, inlined as a text block, and people addressed by platform id.
 *
 * ```
 * [Thread context — messages in this thread before you joined]
 * [Ada Lovelace (<@U0B9NEZ90KH>)] (msg:1787155628.734549): shipping this today
 *
 * <@U0BMHEJ7RLY> can you review it?
 * ```
 */
export interface ChannelContextMessage {
  id: string;
  author: string;
  text: string;
  /** Platform message ids that are epoch timestamps (Slack) — the time it was sent. */
  at?: Date;
  isBot: boolean;
}

export interface ChannelMessageView {
  context: ChannelContextMessage[];
  body: string;
}

const CONTEXT_HEADER = '[Thread context';
const ENTRY = /^\[(.+?)\] \(msg:([^)]+)\): ([\s\S]*)$/;
const AUTHOR_MENTION = /\s*\(<@([^>]+)>\)$/;
/** A history line for someone whose profile the platform did not resolve: `[<@U01>]`. */
const ANONYMOUS_AUTHOR = /^<@([^>]+)>$/;
const BOT_SUFFIX = ' (bot)';
/** `<@U123>` as platforms write it, and `@U123` as adapters leave it when the profile is unknown. */
const MENTION = /<@([UWB][A-Z0-9]{5,})>|(?<![\w@])@([UWB][A-Z0-9]{5,})\b/g;
const EPOCH_MESSAGE_ID = /^(\d{9,})\.\d+$/;

/** Platform user id → display name, for every mention we can put a name to. */
export type MentionNames = ReadonlyMap<string, string>;

export function parseChannelMessage(text: string, names: MentionNames): ChannelMessageView {
  const lines = text.split('\n');
  if (!lines[0]?.startsWith(CONTEXT_HEADER)) return { context: [], body: resolveMentions(text, names) };

  const bodyStart = contextEnd(lines);
  const entries = groupEntries(lines.slice(1, bodyStart));
  const known = new Map(names);
  for (const entry of entries) {
    if (entry.userId && entry.name) known.set(entry.userId, entry.name);
  }

  return {
    context: entries.map(entry => ({
      id: entry.id,
      author: entry.name || authorFromId(entry.userId, known),
      text: resolveMentions(entry.text, known),
      at: sentAt(entry.id),
      isBot: entry.isBot,
    })),
    body: resolveMentions(lines.slice(bodyStart).join('\n').trim(), known),
  };
}

/**
 * Index of the blank line separating the context block from the body. History
 * entries can themselves span blank lines, so the split is the first blank
 * line with no further entry after it.
 */
function contextEnd(lines: string[]): number {
  let end = lines.length;
  for (let index = lines.length - 1; index > 0; index--) {
    if (lines[index]!.trim()) continue;
    if (lines.slice(index + 1).some(line => ENTRY.test(line))) break;
    end = index;
  }
  return end;
}

interface ContextEntry {
  id: string;
  name: string;
  userId?: string;
  text: string;
  isBot: boolean;
}

function groupEntries(lines: string[]): ContextEntry[] {
  const entries: ContextEntry[] = [];
  for (const line of lines) {
    const match = ENTRY.exec(line);
    if (!match) {
      const previous = entries.at(-1);
      if (previous) previous.text += `\n${line}`;
      continue;
    }
    const [, rawPrefix = '', id = '', text = ''] = match;
    const isBot = rawPrefix.endsWith(BOT_SUFFIX);
    const prefix = isBot ? rawPrefix.slice(0, -BOT_SUFFIX.length) : rawPrefix;
    const named = AUTHOR_MENTION.exec(prefix);
    const anonymous = ANONYMOUS_AUTHOR.exec(prefix);
    entries.push({
      id,
      name: anonymous ? '' : (named ? prefix.slice(0, named.index) : prefix).trim(),
      userId: named?.[1] ?? anonymous?.[1],
      text,
      isBot,
    });
  }
  return entries;
}

function authorFromId(userId: string | undefined, names: MentionNames): string {
  if (!userId) return 'Unknown';
  return names.get(userId) ?? `@${userId}`;
}

function sentAt(messageId: string): Date | undefined {
  const seconds = EPOCH_MESSAGE_ID.exec(messageId)?.[1];
  return seconds ? new Date(Number(seconds) * 1000) : undefined;
}

function resolveMentions(text: string, names: MentionNames): string {
  return text.replace(MENTION, (raw, bracketed?: string, bare?: string) => {
    const name = names.get(bracketed ?? bare ?? '');
    return name ? `@${name}` : raw;
  });
}
