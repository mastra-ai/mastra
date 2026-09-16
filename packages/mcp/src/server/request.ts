import { createHash } from 'node:crypto';
import { RequestContext } from '@mastra/core/request-context';
import type { MCPToolExecutionContext } from '@mastra/core/tools';
import { ProtocolError, ProtocolErrorCode, inputResponse } from '@modelcontextprotocol/server';
import type { ServerContext } from '@modelcontextprotocol/server';
import { traceContextFromMeta } from '../shared/trace-context';
import type { MCPAuthInfoToUserMapper } from './types';

const unavailable = (feature: string, replacement: string) => (): Promise<never> =>
  Promise.reject(new Error(`${feature} is not available on a 2026-07-28 server; ${replacement}`));

/**
 * The `context.mcp` a 2026-07-28 request hands to tools: the 1.x shape, with the
 * per-request facilities (cancellation, metadata, auth, log, progress) live and the
 * removed server-initiated requests throwing at the call site.
 */
export function toToolExecutionContext(ctx: ServerContext, loggerName: string): MCPToolExecutionContext {
  const progressToken = ctx.mcpReq._meta?.progressToken;
  return {
    protocolVersion: '2026-07-28',
    extra: {
      ...ctx,
      signal: ctx.mcpReq.signal,
      requestId: ctx.mcpReq.id,
      authInfo: ctx.http?.authInfo,
      _meta: ctx.mcpReq._meta,
      sendNotification: unavailable('extra.sendNotification', 'use context.mcp.log or context.mcp.progress'),
      sendRequest: unavailable('extra.sendRequest', 'the protocol no longer has server-initiated requests'),
    },
    elicitation: {
      sendRequest: unavailable(
        'elicitation.sendRequest',
        'call context.suspend(payload) and read context.resumeData on the next round',
      ),
    },
    // Delivered only when the caller opted in through its `_meta` log level.
    log: (level, message, data) => ctx.mcpReq.log(level, { message, ...data }, loggerName),
    progress: async params => {
      if (progressToken === undefined) return;
      await ctx.mcpReq.notify({ method: 'notifications/progress', params: { progressToken, ...params } });
    },
  };
}

/**
 * Builds the trusted application context for one request. Auth is re-derived from
 * the transport every time; nothing is carried between continuation rounds. The W3C
 * trace fields sent by the client are exposed under `traceContext` as opaque
 * strings for observability only; they are never consulted for authorization.
 */
export async function toRequestContext(
  ctx: ServerContext,
  mapAuthInfoToUser: MCPAuthInfoToUserMapper | undefined,
): Promise<RequestContext> {
  const requestContext = new RequestContext();
  const traceContext = traceContextFromMeta(ctx.mcpReq._meta);
  if (traceContext) requestContext.set('traceContext', traceContext);
  const authInfo = ctx.http?.authInfo;
  if (!authInfo) return requestContext;
  requestContext.set('authInfo', authInfo);
  const user = await mapAuthInfoToUser?.({ authInfo, extra: { authInfo }, requestContext });
  if (user) requestContext.set('user', user);
  return requestContext;
}

/** The identity a continuation is bound to; a different caller cannot resume it. */
export function principalOf(ctx: ServerContext): string {
  const authInfo = ctx.http?.authInfo;
  if (!authInfo) return 'anonymous';
  const subject = authInfo.extra?.sub ?? authInfo.extra?.subject;
  return `${authInfo.clientId}:${typeof subject === 'string' ? subject : ''}`;
}

export function hashArguments(value: unknown): string {
  return createHash('sha256').update(canonicalJSON(value)).digest('base64url');
}

function canonicalJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJSON(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * What the server signs into `requestState` when a handler suspends. It names the
 * exact operation and caller so a continuation can only answer the round it was
 * issued for; `suspendPayload` is what the handler asked to be handed back.
 */
export interface ContinuationEnvelope {
  method: 'tools/call' | 'resources/read' | 'prompts/get';
  name: string;
  argsHash: string;
  principal: string;
  round: number;
  suspendPayload: unknown;
  iat: number;
}

/** The key every suspended round asks the client to answer under. */
export const INPUT_KEY = 'input';

export interface ContinuationRound {
  round: number;
  suspendPayload: unknown;
  /** Present when the client accepted; a decline or cancel ends the request instead. */
  resumeData?: unknown;
  outcome: 'accept' | 'decline' | 'cancel';
}

/**
 * Reads the continuation the SDK already integrity-checked and pairs it with this
 * round's answer. Returns `undefined` for a fresh request.
 */
export function readContinuation(
  ctx: ServerContext,
  expected: Pick<ContinuationEnvelope, 'method' | 'name' | 'argsHash'>,
): ContinuationRound | undefined {
  const envelope = ctx.mcpReq.requestState<ContinuationEnvelope>();
  if (envelope === undefined) return undefined;
  if (
    !envelope ||
    typeof envelope !== 'object' ||
    envelope.method !== expected.method ||
    envelope.name !== expected.name ||
    envelope.argsHash !== expected.argsHash
  ) {
    throw new ProtocolError(
      ProtocolErrorCode.InvalidParams,
      `requestState does not belong to ${expected.method} "${expected.name}" with these arguments`,
    );
  }
  if (envelope.principal !== principalOf(ctx)) {
    throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'requestState was issued to a different caller');
  }
  const answer = inputResponse(ctx.mcpReq.inputResponses, INPUT_KEY);
  if (answer.kind === 'missing') {
    throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Missing input response "${INPUT_KEY}"`);
  }
  if (answer.kind !== 'elicit') {
    throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Unsupported input response "${INPUT_KEY}"`);
  }
  return {
    round: envelope.round,
    suspendPayload: envelope.suspendPayload,
    outcome: answer.action,
    resumeData: answer.action === 'accept' ? (answer.content ?? {}) : undefined,
  };
}
