import type { MessageMetadata, SuspendedToolMetadata } from '../messages/message-metadata';
import { isRecord } from '../messages/signal-data';

/** An embedded request an MCP server sent while its task waits (`{ method, params }`). */
export interface McpInputRequest {
  method: string;
  params?: Record<string, unknown>;
}

/** What `@mastra/mcp` suspends a task-backed tool call with (`MCPInputRequestSuspendPayload`). */
export interface McpInputRequestPayload {
  type: 'mcp-input-request';
  serverName: string;
  toolName: string;
  taskId: string;
  createdAt: string;
  requests: Record<string, McpInputRequest>;
}

export type McpInputAction = 'accept' | 'decline' | 'cancel';

export interface McpInputResponse {
  action: McpInputAction;
  content?: Record<string, unknown>;
}

/** Resume data answering every request key (`MCPInputRequestResumeData`). */
export interface McpInputResumeData {
  inputResponses: Record<string, McpInputResponse>;
}

export function isMcpInputRequest(payload: unknown): payload is McpInputRequestPayload {
  return (
    isRecord(payload) &&
    payload.type === 'mcp-input-request' &&
    typeof payload.serverName === 'string' &&
    typeof payload.toolName === 'string' &&
    typeof payload.taskId === 'string' &&
    typeof payload.createdAt === 'string' &&
    isRecord(payload.requests) &&
    Object.values(payload.requests).every(request => isRecord(request) && typeof request.method === 'string')
  );
}

/**
 * This call's own suspension. Saved entries are keyed by call id, but a live run keys them by tool
 * name (two calls of one tool share that key), so the entry's own `toolCallId` decides.
 */
export function findSuspension(
  metadata: MessageMetadata | undefined,
  toolCallId: string,
): SuspendedToolMetadata | undefined {
  const suspensions = metadata?.suspendedTools;
  if (!suspensions) return undefined;
  return Object.values(suspensions).find(entry => entry?.toolCallId === toolCallId);
}

/** The MCP input request this call is suspended on, if it is. */
export function suspendedMcpInputRequest(
  metadata: MessageMetadata | undefined,
  toolCallId: string,
): McpInputRequestPayload | undefined {
  const payload = findSuspension(metadata, toolCallId)?.suspendPayload;
  return isMcpInputRequest(payload) ? payload : undefined;
}
