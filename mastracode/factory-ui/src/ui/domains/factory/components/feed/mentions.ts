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
export function findMentionQuery(text: string, caret: number): MentionQuery | undefined {
  const beforeCaret = text.slice(0, caret);
  const atIndex = beforeCaret.lastIndexOf('@');
  if (atIndex === -1) return undefined;
  const beforeAt = beforeCaret[atIndex - 1];
  if (beforeAt !== undefined && !/\s/.test(beforeAt)) return undefined;
  const query = beforeCaret.slice(atIndex + 1);
  if (query.length > MAX_MENTION_QUERY_LENGTH || /[\s@]/.test(query)) return undefined;
  return { atIndex, query };
}

export function matchMembers(members: FactoryMentionMember[], query: string): FactoryMentionMember[] {
  const needle = query.toLowerCase();
  return members.filter(member => mentionLabel(member).toLowerCase().startsWith(needle)).slice(0, MAX_MATCHES);
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

/** `@label` standing alone at this `@`: `@Ana` never matches inside `@Anastasia`. */
function matchesAt(text: string, atIndex: number, label: string): boolean {
  if (!text.startsWith(label, atIndex + 1)) return false;
  const after = text[atIndex + 1 + label.length];
  return after === undefined || !WORD_CHAR.test(after);
}

/**
 * Members whose `@Name` survives in the final body, in first-appearance order.
 * The longest label wins at a given `@`, so `@Ana Maria` mentions her alone and
 * not also an `Ana` on the roster.
 */
export function resolveMentions(text: string, members: FactoryMentionMember[]): CommentMentionRef[] {
  const longestFirst = [...members].sort((a, b) => mentionLabel(b).length - mentionLabel(a).length);
  const mentions: CommentMentionRef[] = [];
  const seen = new Set<string>();
  for (let index = text.indexOf('@'); index !== -1; index = text.indexOf('@', index + 1)) {
    const before = index > 0 ? text[index - 1] : undefined;
    // `mail@Ana.example` is an address, not a mention.
    if (before !== undefined && WORD_CHAR.test(before)) continue;
    const member = longestFirst.find(candidate => matchesAt(text, index, mentionLabel(candidate)));
    if (!member || seen.has(member.id)) continue;
    seen.add(member.id);
    mentions.push({ kind: 'user', id: member.id });
    if (mentions.length >= MAX_MENTIONS) break;
  }
  return mentions;
}
