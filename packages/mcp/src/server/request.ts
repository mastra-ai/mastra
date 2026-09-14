import type { MCPRequestContextV2 } from '@mastra/core/mcp';
import { RequestContext } from '@mastra/core/request-context';
import { ProtocolError, ProtocolErrorCode, specTypeSchemas } from '@modelcontextprotocol/server';
import type { ElicitResult, ServerContext } from '@modelcontextprotocol/server';
import type { MCPAuthInfoToUserMapperV2, MCPServerRequest } from './types';

/**
 * Projects the SDK per-request context onto the core native request context.
 *
 * Only elicitation responses are accepted: the server never embeds roots or
 * sampling requests, so any other response shape is a protocol error rather
 * than something handed to application code.
 */
export function toRequestContextV2(ctx: ServerContext, logger: string): MCPRequestContextV2 {
  const inputResponses = ctx.mcpReq.inputResponses && parseInputResponses(ctx.mcpReq.inputResponses);
  const progressToken = ctx.mcpReq._meta?.progressToken;
  return {
    protocolVersion: '2026-07-28',
    requestId: ctx.mcpReq.id,
    signal: ctx.mcpReq.signal,
    metadata: ctx.mcpReq._meta,
    inputResponses,
    requestState: ctx.mcpReq.requestState(),
    log: (level, data, name) => ctx.mcpReq.log(level, data, name ?? logger),
    progress: async (progress, total, message) => {
      if (progressToken === undefined) return;
      await ctx.mcpReq.notify({
        method: 'notifications/progress',
        params: { progressToken, progress, total, message },
      });
    },
  };
}

function parseInputResponses(responses: Record<string, unknown>): Record<string, ElicitResult> {
  const parsed: Record<string, ElicitResult> = {};
  for (const [key, value] of Object.entries(responses)) {
    const result = specTypeSchemas.ElicitResult['~standard'].validate(value);
    if (result instanceof Promise || result.issues) {
      throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Unsupported input response for "${key}"`);
    }
    parsed[key] = result.value;
  }
  return parsed;
}

/**
 * Builds the trusted application context for one request round. Auth is
 * re-derived from the transport every time; nothing is carried between rounds.
 */
export async function toMastraRequestContext(
  ctx: ServerContext,
  mapAuthInfoToUser: MCPAuthInfoToUserMapperV2 | undefined,
): Promise<RequestContext> {
  const requestContext = new RequestContext();
  const authInfo = ctx.http?.authInfo;
  if (!authInfo) return requestContext;
  requestContext.set('authInfo', authInfo);
  const user = await mapAuthInfoToUser?.({ authInfo, requestContext });
  if (user) requestContext.set('user', user);
  return requestContext;
}

export async function toServerRequest(
  ctx: ServerContext,
  logger: string,
  mapAuthInfoToUser: MCPAuthInfoToUserMapperV2 | undefined,
): Promise<MCPServerRequest> {
  return {
    request: toRequestContextV2(ctx, logger),
    requestContext: await toMastraRequestContext(ctx, mapAuthInfoToUser),
  };
}
