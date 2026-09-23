/** Request-body parsing for the comment routes: unknown JSON in, a typed input or `null` out. */

import type { Context } from 'hono';

import { isMentionableActorId } from './actor.js';
import type { FactoryMentionRef } from './base.js';
import { commentBodyError, MAX_COMMENT_MENTIONS, MAX_COMMENT_QUOTE_LENGTH } from './base.js';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLIENT_TOKEN_RE = /^[A-Za-z0-9-]{8,64}$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readJson(c: Context): Promise<unknown> {
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
    if (!isRecord(entry)) return null;
    if (entry.kind !== 'user' || typeof entry.id !== 'string' || !isMentionableActorId(entry.id)) return null;
    mentions.push({ kind: 'user', id: entry.id });
  }
  return mentions;
}

function parseBody(raw: unknown): string | null {
  if (typeof raw !== 'string' || commentBodyError(raw)) return null;
  return raw;
}

function parseClientToken(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || !CLIENT_TOKEN_RE.test(raw)) return null;
  return raw;
}

function parseExpectedRevision(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'number' || !Number.isInteger(raw)) return null;
  return raw;
}

function parseReplyTo(raw: unknown): { commentId: string; quote?: string } | null | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) return null;
  if (typeof raw.commentId !== 'string' || !UUID_RE.test(raw.commentId)) return null;
  if (raw.quote !== undefined && typeof raw.quote !== 'string') return null;
  const quote = typeof raw.quote === 'string' ? raw.quote.slice(0, MAX_COMMENT_QUOTE_LENGTH) : undefined;
  return { commentId: raw.commentId, ...(quote ? { quote } : {}) };
}

export interface ParsedCreateComment {
  body: string;
  clientToken?: string;
  replyTo?: { commentId: string; quote?: string };
  mentions?: FactoryMentionRef[];
}

export function parseCreateCommentBody(raw: unknown): ParsedCreateComment | null {
  if (!isRecord(raw)) return null;

  const body = parseBody(raw.body);
  if (body === null) return null;
  const mentions = parseMentions(raw.mentions);
  if (mentions === null) return null;
  const replyTo = parseReplyTo(raw.replyTo);
  if (replyTo === null) return null;
  const clientToken = parseClientToken(raw.clientToken);
  if (clientToken === null) return null;

  return {
    body,
    ...(clientToken ? { clientToken } : {}),
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
  if (!isRecord(raw)) return null;

  const body = parseBody(raw.body);
  if (body === null) return null;
  const mentions = parseMentions(raw.mentions);
  if (mentions === null) return null;
  const expectedRevision = parseExpectedRevision(raw.expectedRevision);
  if (expectedRevision === null) return null;

  return {
    body,
    ...(mentions ? { mentions } : {}),
    ...(expectedRevision !== undefined ? { expectedRevision } : {}),
  };
}
