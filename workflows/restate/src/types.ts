import type { CoreMessage } from '@mastra/core/llm';
import type { ChunkType } from '@mastra/core/stream';

/**
 * JSON-safe subset of `AgentExecutionOptions` that crosses the Restate
 * invocation boundary. Closures (callbacks, abort signals, delegation hooks)
 * never cross the wire — the service handler wires its own for event recording.
 */
export interface RestateSerializableOptions {
  instructions?: string;
  context?: CoreMessage[];
  memory?: { thread?: string; resource?: string };
  maxSteps?: number;
  stopWhen?: unknown;
  toolsets?: string[];
  clientTools?: string[];
  toolChoice?: string;
  activeTools?: string[];
  modelSettings?: Record<string, unknown>;
  requireToolApproval?: boolean;
  autoResumeSuspendedTools?: boolean;
  toolCallConcurrency?: number;
  includeRawChunks?: boolean;
  maxProcessorRetries?: number;
  structuredOutput?: unknown;
  versions?: Record<string, string>;
  system?: string;
  disableBackgroundTasks?: boolean;
  model?: string;
  requestContext?: Record<string, unknown>;
}

/** Request body for the durable agent service `run` handler. */
export interface RestateAgentRunRequest {
  runId: string;
  messages: CoreMessage[];
  options: RestateSerializableOptions;
  resumeData?: unknown;
}

/** A single recorded stream event, journaled for `observe()`. */
export interface RestateStreamEvent {
  type: 'chunk' | 'step-finish' | 'suspended' | 'finish';
  chunk?: ChunkType;
  step?: unknown;
  data?: unknown;
}

/** Per-run in-memory state. Durable state lives in the Restate journal. */
export interface RestateRunState {
  runId: string;
  status: 'running' | 'completed' | 'suspended' | 'aborted' | 'failed';
  events: RestateStreamEvent[];
  result?: RestateAgentRunResult;
  awakeableId?: string;
  toolCall?: { toolCallId?: string; toolName?: string; args?: unknown };
  error?: string;
}

/** Serialized terminal result of an agent run. */
export interface RestateAgentRunResult {
  text: string;
  chunks: ChunkType[];
  steps: unknown[];
  usage: unknown;
  finishReason: string;
  suspendPayload?: unknown;
  warnings?: unknown[];
  modelId?: string;
  provider?: string;
}

/** Resolution payload for an approval awakeable. */
export interface RestateApprovalResolution {
  approved: boolean;
  toolCallId?: string;
  resumeData?: unknown;
}
