import type { JSONSchema7 } from 'json-schema';
import type { MCPLoggingLevel } from '../tools/types';

export const MCP_PROTOCOL_VERSION_V2 = '2026-07-28' as const;

/**
 * Per-request facilities an MCP 2026-07-28 server exposes to the handler it is
 * running (a tool, a resource read or a prompt render). Every request is
 * self-contained: there is no session, and nothing here outlives the request.
 */
export interface MCPRequestContextV2 {
  readonly protocolVersion: typeof MCP_PROTOCOL_VERSION_V2;
  readonly requestId: string | number;
  /** Aborted when the client cancels or disconnects. */
  readonly signal: AbortSignal;
  /** The request's `_meta` (trace headers, log-level opt-in, progress token, …). */
  readonly metadata: Readonly<Record<string, unknown>>;
  /** Sends a `notifications/message` on this request's stream; dropped unless the client opted in. */
  log(level: MCPLoggingLevel, data: unknown, logger?: string): Promise<void>;
  /** Sends a `notifications/progress`; no-op unless the client supplied a progress token. */
  progress(progress: number, total?: number, message?: string): Promise<void>;
}

/**
 * Suspend/resume facilities the MCP server adds on top of the request context.
 * Mirrors `AgentToolExecutionContext` / `WorkflowToolExecutionContext`: a
 * handler that calls `suspend(payload)` ends the request as `input_required`;
 * the continuation request re-enters the same handler with `resumeData` (the
 * answer to that round only) and `suspendPayload` (what the handler suspended
 * with). Nothing else is carried between rounds.
 */
export interface MCPSuspendContextV2<TSuspend = unknown, TResume = unknown> {
  suspend: (suspendPayload: TSuspend) => Promise<void>;
  resumeData?: TResume;
  suspendPayload?: TSuspend;
}

/** `context.mcpv2` for a tool executed by an MCP 2026-07-28 server. */
export type MCPToolExecutionContextV2<TSuspend = unknown, TResume = unknown> = MCPRequestContextV2 &
  MCPSuspendContextV2<TSuspend, TResume>;

/**
 * What `executeTool` resolves to on a server with `mcpVersion === 2`. A tool that
 * calls `context.mcpv2.suspend(payload)` is reported as `suspended` together with
 * the payload and its `resumeSchema` (as JSON Schema) so the caller can ask for
 * exactly that input; otherwise the tool's output is returned as `completed`.
 */
export type MCPToolExecutionResultV2 =
  | { status: 'completed'; output: unknown }
  | { status: 'suspended'; suspendPayload: unknown; resumeSchema?: JSONSchema7 };
