import type { Writable } from 'node:stream';
import type { MastraModelOutput, FullOutput } from '../stream/base/output';
import type { ChunkType } from '../stream/types';

/**
 * Output format options for headless mode.
 */
export type OutputFormat = 'text' | 'json' | 'stream-json';

/**
 * Shape of the single-object JSON envelope emitted by `json` mode.
 */
export interface JsonResultEnvelope<OUTPUT = undefined> {
  type: 'result';
  subtype: 'success' | 'error' | 'interrupted';
  is_error: boolean;
  result: string;
  object: OUTPUT | null;
  duration_ms: number;
  num_turns: number;
  usage: {
    input_tokens: number | undefined;
    output_tokens: number | undefined;
    total_tokens: number | undefined;
    cached_input_tokens: number | undefined;
    reasoning_tokens: number | undefined;
  };
  finish_reason: string | undefined;
  model_id: string;
  trace_id: string | undefined;
  run_id: string | undefined;
  tool_calls: Array<{ id: string; name: string; args: unknown }>;
  tool_results: Array<{ id: string; name: string; result: unknown; isError: boolean }>;
  warnings: unknown[];
}

/**
 * Build the JSON result envelope from a FullOutput.
 */
export function buildJsonEnvelope<OUTPUT = undefined>(
  fullOutput: FullOutput<OUTPUT>,
  durationMs: number,
): JsonResultEnvelope<OUTPUT> {
  const isError = !!fullOutput.error;
  const totalUsage = fullOutput.totalUsage;

  return {
    type: 'result',
    subtype: isError ? 'error' : 'success',
    is_error: isError,
    result: fullOutput.text,
    object: fullOutput.object ?? null,
    duration_ms: durationMs,
    num_turns: fullOutput.steps.length,
    usage: {
      input_tokens: totalUsage?.inputTokens,
      output_tokens: totalUsage?.outputTokens,
      total_tokens: totalUsage?.totalTokens,
      cached_input_tokens: (totalUsage as any)?.cachedInputTokens,
      reasoning_tokens: (totalUsage as any)?.reasoningTokens,
    },
    finish_reason: fullOutput.finishReason,
    model_id: fullOutput.response?.modelId ?? '',
    trace_id: fullOutput.traceId,
    run_id: fullOutput.runId,
    tool_calls: fullOutput.toolCalls.map(tc => ({
      id: tc.payload.toolCallId,
      name: tc.payload.toolName,
      args: tc.payload.args,
    })),
    tool_results: fullOutput.toolResults.map(tr => ({
      id: tr.payload.toolCallId,
      name: tr.payload.toolName,
      result: tr.payload.result,
      isError: tr.payload.isError ?? false,
    })),
    warnings: fullOutput.warnings,
  };
}

/**
 * Build an interrupted envelope (emitted on SIGINT in json mode).
 */
export function buildInterruptedEnvelope(durationMs: number): JsonResultEnvelope {
  return {
    type: 'result',
    subtype: 'interrupted',
    is_error: true,
    result: '',
    object: null,
    duration_ms: durationMs,
    num_turns: 0,
    usage: {
      input_tokens: undefined,
      output_tokens: undefined,
      total_tokens: undefined,
      cached_input_tokens: undefined,
      reasoning_tokens: undefined,
    },
    finish_reason: undefined,
    model_id: '',
    trace_id: undefined,
    run_id: undefined,
    tool_calls: [],
    tool_results: [],
    warnings: [],
  };
}

/**
 * Format output in `text` mode: stream text-delta payloads to stdout,
 * warnings/errors to stderr.
 */
export async function formatText<OUTPUT>(
  streamOutput: MastraModelOutput<OUTPUT>,
  stdout: Writable,
  stderr: Writable,
): Promise<FullOutput<OUTPUT>> {
  const reader = streamOutput.fullStream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = value as ChunkType<OUTPUT>;
      if (chunk.type === 'text-delta') {
        stdout.write((chunk.payload as { text: string }).text);
      } else if (chunk.type === 'error') {
        stderr.write(`Error: ${String((chunk.payload as { error: unknown }).error)}\n`);
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Trailing newline for clean terminal output
  stdout.write('\n');

  return streamOutput.getFullOutput();
}

/**
 * Format output in `json` mode: await completion, emit single JSON envelope to stdout.
 */
export async function formatJson<OUTPUT>(
  streamOutput: MastraModelOutput<OUTPUT>,
  stdout: Writable,
  startTime: number,
): Promise<FullOutput<OUTPUT>> {
  const fullOutput = await streamOutput.getFullOutput();
  const durationMs = Date.now() - startTime;
  const envelope = buildJsonEnvelope(fullOutput, durationMs);
  stdout.write(JSON.stringify(envelope) + '\n');
  return fullOutput;
}

/**
 * Format output in `stream-json` mode: emit each ChunkType as an NDJSON line to stdout.
 */
export async function formatStreamJson<OUTPUT>(
  streamOutput: MastraModelOutput<OUTPUT>,
  stdout: Writable,
  _stderr: Writable,
): Promise<FullOutput<OUTPUT>> {
  const reader = streamOutput.fullStream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      stdout.write(JSON.stringify(value) + '\n');
    }
  } finally {
    reader.releaseLock();
  }

  return streamOutput.getFullOutput();
}

/**
 * Determine if a FullOutput has warnings, for --strict exit code logic.
 */
export function hasWarnings<OUTPUT>(fullOutput: FullOutput<OUTPUT>): boolean {
  return fullOutput.warnings.length > 0;
}
