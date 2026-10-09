const WORK_ITEM_FEED_TAG = 'work-item-feed';

export interface SkillActivation {
  name: string;
  instructions: string;
  arguments?: string;
  /** The work-item feed appended after the envelope: comments written by collaborators, shown as context. */
  feed?: string;
}

/**
 * Pattern matching `<skill name="…">body</skill>`, anchored to the start of the
 * trimmed string. Only the work-item feed may trail the envelope; anything else
 * trailing keeps the message raw.
 */
const SKILL_PATTERN = /^<skill\s+name="([^"]+)">([\s\S]*?)<\/skill>\s*([\s\S]*)$/;
const FEED_BLOCK_PATTERN = new RegExp(`^<${WORK_ITEM_FEED_TAG}>\\s*([\\s\\S]*?)\\s*</${WORK_ITEM_FEED_TAG}>$`);
const ARGUMENTS_MARKER = '\n\nARGUMENTS: ';

export function parseSkillActivation(text: string): SkillActivation | undefined {
  const match = SKILL_PATTERN.exec(text.trim());
  if (!match) return undefined;

  const [, name, rawBody = '', rawTrailing = ''] = match;
  const trailing = rawTrailing.trim();
  const feedBlock = trailing ? FEED_BLOCK_PATTERN.exec(trailing) : undefined;
  if (trailing && !feedBlock) return undefined;

  if (!name) return undefined;

  // The envelope wraps the content in `>\n{body}\n</skill>`.
  let body = rawBody;
  if (body.startsWith('\n')) body = body.slice(1);
  if (body.endsWith('\n')) body = body.slice(0, -1);

  // Unescape the boundary sentinel inserted to prevent premature envelope closure.
  body = body.replaceAll('&lt;/skill&gt;', '</skill>');

  if (!body.trim()) return undefined;

  const argIndex = body.lastIndexOf(ARGUMENTS_MARKER);
  const instructions = argIndex >= 0 ? body.slice(0, argIndex) : body;
  const args = argIndex >= 0 ? body.slice(argIndex + ARGUMENTS_MARKER.length).trim() : undefined;

  return { name, instructions, arguments: args || undefined, ...(feedBlock ? { feed: feedBlock[1] ?? '' } : {}) };
}
