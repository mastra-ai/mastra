/** Request-body parsing for the comment routes: unknown JSON in, a typed input or `null` out. */

import type { Context } from 'hono';

import { isMentionableActorId } from './actor.js';
import type { FactoryMentionRef } from './base.js';
import { MAX_COMMENT_BODY_LENGTH, MAX_COMMENT_MENTIONS, MAX_COMMENT_QUOTE_LENGTH } from './base.js';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLIENT_TOKEN_RE = /^[A-Za-z0-9-]{8,64}$/;

export async function readJson(c: Context): Promise<unknown | undefined> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

/** `undefined` when the field is absent, `null` when it is present but malformed. */
function parseMentions(raw: unknown): FactoryMentionRef[] | null | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.length > MAX_COMMENT_MENTIONS) return null;
  const mentions: FactoryMentionRef[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return null;
    const mention = entry as Record<string, unknown>;
    if (mention.kind !== 'user' || typeof mention.id !== 'string' || !isMentionableActorId(mention.id)) return null;
    mentions.push({ kind: 'user', id: mention.id });
  }
  return mentions;
}

function parseBody(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > MAX_COMMENT_BODY_LENGTH) return null;
  return raw;
}

function parseReplyTo(raw: unknown): { commentId: string; quote?: string } | null | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object') return null;
  const reply = raw as Record<string, unknown>;
  if (typeof reply.commentId !== 'string' || !UUID_RE.test(reply.commentId)) return null;
  if (reply.quote !== undefined && typeof reply.quote !== 'string') return null;
  const quote = typeof reply.quote === 'string' ? reply.quote.slice(0, MAX_COMMENT_QUOTE_LENGTH) : undefined;
  return { commentId: reply.commentId, ...(quote ? { quote } : {}) };
}

export interface ParsedCreateComment {
  body: string;
  clientToken?: string;
  replyTo?: { commentId: string; quote?: string };
  mentions?: FactoryMentionRef[];
}

export function parseCreateCommentBody(raw: unknown): ParsedCreateComment | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;

  const body = parseBody(input.body);
  if (body === null) return null;
  const mentions = parseMentions(input.mentions);
  if (mentions === null) return null;
  const replyTo = parseReplyTo(input.replyTo);
  if (replyTo === null) return null;
  if (
    input.clientToken !== undefined &&
    (typeof input.clientToken !== 'string' || !CLIENT_TOKEN_RE.test(input.clientToken))
  ) {
    return null;
  }

  return {
    body,
    ...(typeof input.clientToken === 'string' ? { clientToken: input.clientToken } : {}),
    ...(replyTo ? { replyTo } : {}),
    ...(mentions ? { mentions } : {}),
  };
}

export interface ParsedEditComment {
  body: string;
  mentions?: FactoryMentionRef[];
  expectedRevision?: number;
}

export function parseEditCommentBody(raw: unknown): ParsedEditComment | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;

  const body = parseBody(input.body);
  if (body === null) return null;
  const mentions = parseMentions(input.mentions);
  if (mentions === null) return null;
  if (input.expectedRevision !== undefined && !Number.isInteger(input.expectedRevision)) return null;

  return {
    body,
    ...(mentions ? { mentions } : {}),
    ...(typeof input.expectedRevision === 'number' ? { expectedRevision: input.expectedRevision } : {}),
  };
}
