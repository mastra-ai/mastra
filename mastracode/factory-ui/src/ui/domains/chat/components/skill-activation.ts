// ---------------------------------------------------------------------------
// Skill-envelope parser — pure logic, no React dependencies.
// Shared by SkillMessage.tsx (component) and unit tests.
// ---------------------------------------------------------------------------

import { WORK_ITEM_FEED_TAG } from '@mastra/factory/storage/domains/comments/feed-context';
import { FACTORY_DOCS_TAG } from '@mastra/factory/storage/domains/documents/prompt-context';

export interface SkillActivation {
  name: string;
  instructions: string;
  arguments?: string;
  /** The work-item feed the server appended after the envelope: comments written by collaborators, shown as context. */
  feed?: string;
  /** The project document index the server appended after the feed: the docs/factory catalog, shown as context. */
  docs?: string;
}

/**
 * Pattern matching `<skill name="…">body</skill>`, anchored to the start of the
 * trimmed string. Only the work-item feed (`withFeedContext` in factory) and
 * the document index (`withDocsContext`), in that order and each optional, may
 * trail the envelope; anything else trailing keeps the message raw.
 */
const SKILL_PATTERN = /^<skill\s+name="([^"]+)">([\s\S]*?)<\/skill>\s*([\s\S]*)$/;
const FEED_BLOCK_PATTERN = new RegExp(
  `^<${WORK_ITEM_FEED_TAG}>\\s*([\\s\\S]*?)\\s*</${WORK_ITEM_FEED_TAG}>\\s*([\\s\\S]*)$`,
);
const DOCS_BLOCK_PATTERN = new RegExp(`^<${FACTORY_DOCS_TAG}>\\s*([\\s\\S]*?)\\s*</${FACTORY_DOCS_TAG}>$`);
const ARGUMENTS_MARKER = '\n\nARGUMENTS: ';

/** Split the text after the envelope into its allowed blocks; undefined when anything else is present. */
function parseTrailingBlocks(trailing: string): { feed?: string; docs?: string } | undefined {
  if (!trailing) return {};
  const feedMatch = FEED_BLOCK_PATTERN.exec(trailing);
  const feed = feedMatch?.[1];
  const rest = feedMatch ? feedMatch[2].trim() : trailing;
  if (!rest) return feed === undefined ? {} : { feed };
  const docsMatch = DOCS_BLOCK_PATTERN.exec(rest);
  if (!docsMatch) return undefined;
  return { ...(feed === undefined ? {} : { feed }), docs: docsMatch[1] };
}

export function parseSkillActivation(text: string): SkillActivation | undefined {
  const match = SKILL_PATTERN.exec(text.trim());
  if (!match) return undefined;

  const blocks = parseTrailingBlocks(match[3].trim());
  if (!blocks) return undefined;

  const name = match[1];
  if (!name) return undefined;

  // Trim a single leading/trailing newline from the body (the envelope
  // format wraps the content in `>\n{body}\n</skill>`).
  let body = match[2];
  if (body.startsWith('\n')) body = body.slice(1);
  if (body.endsWith('\n')) body = body.slice(0, -1);

  // Unescape the boundary sentinel that `escapeSkillBoundary` inserts to
  // prevent premature envelope closure (`start-coordinator.ts:56`).
  body = body.replaceAll('&lt;/skill&gt;', '</skill>');

  if (!body.trim()) return undefined;

  // Split a trailing ARGUMENTS block from the instructions.
  const argIndex = body.lastIndexOf(ARGUMENTS_MARKER);
  const instructions = argIndex >= 0 ? body.slice(0, argIndex) : body;
  const args = argIndex >= 0 ? body.slice(argIndex + ARGUMENTS_MARKER.length).trim() : undefined;

  return { name, instructions, arguments: args || undefined, ...blocks };
}
