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
  /** Index of the `@` in the text. */
  start: number;
  query: string;
}

export function mentionLabel(member: FactoryMentionMember): string {
  return member.name ?? member.id;
}

/** The `@query` the caret sits in, if any: `@` at a word start, no whitespace between it and the caret. */
export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  const upTo = text.slice(0, caret);
  const at = upTo.lastIndexOf('@');
  if (at === -1) return null;
  const before = upTo[at - 1];
  if (before !== undefined && !/\s/.test(before)) return null;
  const query = upTo.slice(at + 1);
  if (query.length > MAX_MENTION_QUERY_LENGTH || /[\s@]/.test(query)) return null;
  return { start: at, query };
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
  const nextText = text.slice(0, mention.start) + inserted + text.slice(caret);
  return { text: nextText, caret: mention.start + inserted.length };
}

/** Members whose `@Name` survives in the final body, in first-appearance order. */
export function resolveMentions(text: string, members: FactoryMentionMember[]): CommentMentionRef[] {
  const found = members
    .map(member => ({ member, index: text.indexOf(`@${mentionLabel(member)}`) }))
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
