import { z } from 'zod/v4';
import { TaskInputRequestsSchema } from '../../shared/tasks/schemas';
import type { MCPInputRequestResumeData, MCPInputRequestSuspendPayload } from '../types';

export const MCP_INPUT_REQUEST_SUSPEND_TYPE = 'mcp-input-request';

/** Where an agent or workflow hands a tool its suspend function and, on resume, what it suspended with. */
export interface ToolSuspendHost {
  suspend?: (payload: MCPInputRequestSuspendPayload) => Promise<void>;
  resumeData?: unknown;
  suspendPayload?: unknown;
}

const SuspendPayloadSchema = z.object({
  type: z.literal(MCP_INPUT_REQUEST_SUSPEND_TYPE),
  serverName: z.string(),
  toolName: z.string(),
  taskId: z.string().min(1),
  createdAt: z.string(),
  requests: TaskInputRequestsSchema,
});

const ResumeDataSchema = z.object({
  inputResponses: z.record(
    z.string(),
    z.object({
      action: z.enum(['accept', 'decline', 'cancel']),
      content: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
});

export type InputRequestResume =
  | { ok: true; payload: MCPInputRequestSuspendPayload; inputResponses: MCPInputRequestResumeData['inputResponses'] }
  | { ok: false; reason: string };

/**
 * Reads a resume of a tool call that suspended on MCP task input. Returns `undefined` when the call
 * didn't suspend that way, so other resumes (tool approval, for one) take the normal path.
 */
export function readInputRequestResume(
  host: ToolSuspendHost | undefined,
  expected: { serverName: string; toolName: string },
): InputRequestResume | undefined {
  const raw = host?.suspendPayload;
  if (!raw || typeof raw !== 'object' || (raw as { type?: unknown }).type !== MCP_INPUT_REQUEST_SUSPEND_TYPE) {
    return undefined;
  }
  const payload = SuspendPayloadSchema.safeParse(raw);
  if (!payload.success) return { ok: false, reason: `the suspended MCP input request is malformed` };
  if (payload.data.serverName !== expected.serverName || payload.data.toolName !== expected.toolName) {
    return { ok: false, reason: `the suspended MCP input request belongs to another tool` };
  }
  const resume = ResumeDataSchema.safeParse(host?.resumeData);
  if (!resume.success) {
    return {
      ok: false,
      reason: `resume data must be { inputResponses: { [key]: { action: 'accept' | 'decline' | 'cancel', content? } } }`,
    };
  }
  const missing = Object.keys(payload.data.requests).filter(key => !Object.hasOwn(resume.data.inputResponses, key));
  if (missing.length > 0) return { ok: false, reason: `resume data has no answer for ${missing.join(', ')}` };
  return {
    ok: true,
    payload: payload.data as MCPInputRequestSuspendPayload,
    inputResponses: resume.data.inputResponses as MCPInputRequestResumeData['inputResponses'],
  };
}
