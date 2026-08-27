/**
 * Pure @mention machinery for the comment composer. The body stays plain
 * `@Name` text; the structured mention list sent to the server is re-derived
 * from the final body, so deleting a name from the text drops its mention.
 */

import type { FactoryMentionMember } from '../../services/members';
import type { CommentMentionRef } from '../../services/commentsWire';

export const MAX_MENTION_QUERY_LENGTH = 32;
const MAX_MENTIONS = 20;
const MAX_MATCHES = 8;

export interface MentionQuery {
  atIndex: number;
  query: string;
}

export function mentionLabel(member: FactoryMentionMember): string {
  return member.name ?? member.id;
}

/** The `@query` the caret sits in, if any: `@` at a word start, no whitespace between it and the caret. */
export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  const beforeCaret = text.slice(0, caret);
  const atIndex = beforeCaret.lastIndexOf('@');
  if (atIndex === -1) return null;
  const beforeAt = beforeCaret[atIndex - 1];
  if (beforeAt !== undefined && !/\s/.test(beforeAt)) return null;
  const query = beforeCaret.slice(atIndex + 1);
  if (query.length > MAX_MENTION_QUERY_LENGTH || /[\s@]/.test(query)) return null;
  return { atIndex, query };
}

export function matchMembers(members: FactoryMentionMember[], query: string): FactoryMentionMember[] {
  const needle = query.toLowerCase();
  return members.filter(member => mentionLabel(member).toLowerCase().startsWith(needle)).slice(0, MAX_MATCHES);
}

/** Replace the active `@query` with the member's `@Name ` and put the caret after it. */
export function applyMention(
  text: string,
  caret: number,
  mention: MentionQuery,
  member: FactoryMentionMember,
): { text: string; caret: number } {
  const inserted = `@${mentionLabel(member)} `;
  const nextText = text.slice(0, mention.atIndex) + inserted + text.slice(caret);
  return { text: nextText, caret: mention.atIndex + inserted.length };
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

/**
 * First standalone occurrence of `@label`: `@Ana` never matches inside
 * `@Anastasia`, and `mail@Ana.example` is an address, not a mention.
 */
function findMentionIndex(text: string, label: string): number {
  const token = `@${label}`;
  for (let index = text.indexOf(token); index !== -1; index = text.indexOf(token, index + 1)) {
    const before = index > 0 ? text[index - 1] : undefined;
    const after = text[index + token.length];
    if (before !== undefined && WORD_CHAR.test(before)) continue;
    if (after === undefined || !WORD_CHAR.test(after)) return index;
  }
  return -1;
}

/** Members whose `@Name` survives in the final body, in first-appearance order. */
export function resolveMentions(text: string, members: FactoryMentionMember[]): CommentMentionRef[] {
  const found = members
    .map(member => ({ member, index: findMentionIndex(text, mentionLabel(member)) }))
    .filter(entry => entry.index !== -1)
    .sort((a, b) => a.index - b.index);
  const seen = new Set<string>();
  const mentions: CommentMentionRef[] = [];
  for (const { member } of found) {
    if (seen.has(member.id)) continue;
    seen.add(member.id);
    mentions.push({ kind: 'user', id: member.id });
    if (mentions.length >= MAX_MENTIONS) break;
  }
  return mentions;
}
