import type { JSONSchema7 } from 'json-schema';
import type { MCPLoggingLevel } from '../tools/types';

export const MCP_PROTOCOL_VERSION_V2 = '2026-07-28' as const;

/**
 * Per-request facilities an MCP 2026-07-28 server exposes to the handler it is
 * running (a tool, a resource read or a prompt render). Every request is
 * self-contained: there is no session, and nothing here outlives the request.
 *
 * A tool receives this as `context.mcpv2`. Suspend/resume is not part of it:
 * a tool that needs input calls the top-level `context.suspend(payload)` and is
 * re-entered with `context.resumeData` / `context.suspendPayload`, exactly as
 * when it is executed directly.
 */
export interface MCPRequestContextV2 {
  readonly protocolVersion: typeof MCP_PROTOCOL_VERSION_V2;
  readonly requestId: string | number;
  /** Aborted when the client cancels or disconnects. */
  readonly signal: AbortSignal;
  /** The request's `_meta` (trace headers, log-level opt-in, progress token, …). */
  readonly _meta?: Readonly<Record<string, unknown>>;
  /** Sends a `notifications/message` on this request's stream; dropped unless the client opted in. */
  log(level: MCPLoggingLevel, message: string, data?: Record<string, unknown>): Promise<void>;
  /** Sends a `notifications/progress`; no-op unless the client supplied a progress token. */
  progress(params: { progress: number; total?: number; message?: string }): Promise<void>;
}

/**
 * What `executeTool` resolves to on a server with `mcpVersion === 2`. A tool that
 * calls `context.suspend(payload)` is reported as `suspended` together with the
 * payload and its `resumeSchema` (as JSON Schema) so the caller can ask for
 * exactly that input; otherwise the tool's output is returned as `completed`.
 */
export type MCPToolExecutionResultV2 =
  | { status: 'completed'; output: unknown }
  | { status: 'suspended'; suspendPayload: unknown; resumeSchema?: JSONSchema7 };
