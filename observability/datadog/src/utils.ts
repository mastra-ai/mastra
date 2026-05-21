/**
 * Utility functions for Datadog LLM Observability Exporter
 */

import { SpanType } from '@mastra/core/observability';
import tracer from 'dd-trace';
import { isModelInferenceEnabled } from './features';

/**
 * Datadog LLM Observability span kinds.
 */
export type DatadogSpanKind = 'llm' | 'agent' | 'workflow' | 'tool' | 'task' | 'retrieval' | 'embedding';

type DatadogToolCall = {
  name?: string;
  arguments?: Record<string, any>;
  toolId?: string;
  type?: string;
};

type DatadogMessage = {
  role: string;
  content: string;
  toolCalls?: DatadogToolCall[];
};

/**
 * Maps Mastra SpanTypes to Datadog LLMObs span kinds for the legacy hierarchy
 * (no `model-inference-span` feature). MODEL_STEP is the actual API call here
 * because MODEL_INFERENCE doesn't exist.
 *
 * Unmapped types fall back to 'task'.
 */
const SPAN_TYPE_TO_KIND_LEGACY: Partial<Record<SpanType, DatadogSpanKind>> = {
  [SpanType.AGENT_RUN]: 'agent',
  [SpanType.MODEL_GENERATION]: 'workflow',
  [SpanType.MODEL_STEP]: 'llm',
  [SpanType.TOOL_CALL]: 'tool',
  [SpanType.MCP_TOOL_CALL]: 'tool',
  [SpanType.WORKFLOW_RUN]: 'workflow',
};

/**
 * Maps Mastra SpanTypes to Datadog LLMObs span kinds for the new hierarchy
 * (`model-inference-span` feature). MODEL_INFERENCE is the LLM API call;
 * MODEL_STEP wraps processors + inference + tool execution as a workflow.
 *
 * Unmapped types fall back to 'task'.
 */
const SPAN_TYPE_TO_KIND_INFERENCE: Partial<Record<SpanType, DatadogSpanKind>> = {
  [SpanType.AGENT_RUN]: 'agent',
  [SpanType.MODEL_GENERATION]: 'workflow',
  [SpanType.MODEL_STEP]: 'workflow',
  [SpanType.MODEL_INFERENCE]: 'llm',
  [SpanType.TOOL_CALL]: 'tool',
  [SpanType.MCP_TOOL_CALL]: 'tool',
  [SpanType.WORKFLOW_RUN]: 'workflow',
};

/**
 * Resolves the active span-type → Datadog kind mapping based on whether the
 * paired @mastra/core + @mastra/observability emit MODEL_INFERENCE spans.
 * Re-evaluated on each call so tests can flip the feature flag at runtime.
 */
export function getSpanTypeToKind(): Partial<Record<SpanType, DatadogSpanKind>> {
  return isModelInferenceEnabled() ? SPAN_TYPE_TO_KIND_INFERENCE : SPAN_TYPE_TO_KIND_LEGACY;
}

/** @deprecated Prefer `getSpanTypeToKind()` so the mapping reflects the active feature flag. */
export const SPAN_TYPE_TO_KIND: Partial<Record<SpanType, DatadogSpanKind>> = SPAN_TYPE_TO_KIND_LEGACY;

/**
 * Singleton flag to prevent multiple tracer initializations.
 * dd-trace should only be initialized once per process.
 */
const tracerInitFlag = { done: false };

/**
 * Ensures dd-trace is initialized exactly once.
 * Respects any existing tracer initialization by the application.
 */
export function ensureTracer(config: {
  mlApp: string;
  site: string;
  apiKey?: string;
  agentless: boolean;
  service?: string;
  env?: string;
  integrationsEnabled?: boolean;
}): void {
  if (tracerInitFlag.done) return;

  // Set environment variables for dd-trace to pick up
  // (LLMObsEnableOptions only accepts mlApp and agentlessEnabled)
  // Always set when config is provided to ensure explicit config takes precedence
  // over any stale env vars that may already be set in the process
  if (config.site) {
    process.env.DD_SITE = config.site;
  }
  if (config.apiKey) {
    process.env.DD_API_KEY = config.apiKey;
  }

  // Check if tracer was already started by the application
  const alreadyStarted = (tracer as any)._tracer?.started;

  if (!alreadyStarted) {
    tracer.init({
      service: config.service || config.mlApp,
      env: config.env || process.env.DD_ENV,
      // Disable automatic integrations by default to avoid surprise instrumentation
      plugins: config.integrationsEnabled ?? false,
    });
  }

  // Enable LLM Observability with the resolved configuration
  tracer.llmobs.enable({
    mlApp: config.mlApp,
    agentlessEnabled: config.agentless,
  });

  tracerInitFlag.done = true;
}

/**
 * Returns the Datadog kind for a Mastra span type, using the mapping that
 * matches the active span hierarchy (legacy vs MODEL_INFERENCE).
 */
export function kindFor(spanType: SpanType): DatadogSpanKind {
  return getSpanTypeToKind()[spanType] || 'task';
}

/**
 * Converts a value to a Date object.
 */
export function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Safely stringifies data, handling circular references.
 */
export function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(data) ?? '';
  } catch {
    if (typeof data === 'object' && data !== null) {
      return `[Non-serializable ${data.constructor?.name || 'Object'}]`;
    }
    return String(data);
  }
}

/**
 * Checks if data is already in message array format ({role, content}[]).
 */
function isMessageArray(data: any): data is Array<{ role: string; content: any; toolCalls?: DatadogToolCall[] }> {
  return Array.isArray(data) && data.every(m => m?.role && (m?.content !== undefined || Array.isArray(m.toolCalls)));
}

function isModelDataSpan(spanType: SpanType): boolean {
  return (
    spanType === SpanType.MODEL_GENERATION || spanType === SpanType.MODEL_STEP || spanType === SpanType.MODEL_INFERENCE
  );
}

/**
 * Checks if data is in Gemini content array format ({role, parts}[]).
 */
function isGeminiContentArray(data: any): data is Array<{ role: string; parts: any[] }> {
  return Array.isArray(data) && data.every(m => m?.role && Array.isArray(m?.parts));
}

function toMessageContent(content: any): string {
  return typeof content === 'string' ? content : safeStringify(content);
}

/**
 * Maps a {role, content}[] message array into the Datadog message shape,
 * stringifying any non-string content (e.g. multimodal part arrays).
 */
function toDatadogMessages(
  messages: Array<{ role: string; content: any; toolCalls?: DatadogToolCall[] }>,
): DatadogMessage[] {
  return messages
    .map(m => {
      const message: DatadogMessage = {
        role: m.role,
        content: m.content == null ? '' : toMessageContent(m.content),
      };
      if (m.toolCalls) {
        message.toolCalls = m.toolCalls;
      }
      return message;
    })
    .filter(m => !(m.role === 'user' && m.content.trim().length === 0));
}

function parseToolArguments(args: unknown): Record<string, any> | undefined {
  if (args == null) return undefined;
  if (typeof args === 'string') {
    try {
      const parsed = JSON.parse(args);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Datadog's tool-call schema expects an object. Preserve opaque strings
      // under a stable key instead of dropping the argument payload.
    }
    return { value: args };
  }
  if (typeof args === 'object' && !Array.isArray(args)) return args as Record<string, any>;
  return { value: args };
}

function toDatadogToolCalls(toolCalls: any[]): DatadogToolCall[] {
  return toolCalls.map(c => ({
    name: c?.toolName ?? c?.name ?? c?.function?.name ?? 'unknown',
    arguments: parseToolArguments(c?.args ?? c?.input ?? c?.function?.arguments),
    toolId: c?.toolCallId ?? c?.toolId ?? c?.id,
    type: c?.type === 'function' ? c.type : 'function',
  }));
}

/**
 * Converts a Gemini content item to Datadog message format.
 * Extracts text from parts, skips binary data to avoid bloating traces.
 */
function geminiContentToMessage(item: { role: string; parts: any[] }): { role: string; content: string } {
  const text = item.parts
    .map(p => {
      if (typeof p === 'string') return p;
      if (p?.text) return p.text;
      if (p?.inlineData) return `[${p.inlineData.mimeType ?? 'binary'}]`;
      if (p?.functionCall) return `[tool: ${p.functionCall.name ?? 'unknown'}]`;
      return safeStringify(p);
    })
    .join('');
  return { role: item.role, content: text };
}

/**
 * Formats input data for Datadog annotations.
 * Model spans use message array format; others use raw or stringified data.
 */
export function formatInput(input: any, spanType: SpanType): any {
  // Model spans expect {role, content}[] format
  if (isModelDataSpan(spanType)) {
    // Already in message format
    if (isMessageArray(input)) {
      return toDatadogMessages(input);
    }
    // Gemini format: {role, parts} → normalize to {role, content}
    if (isGeminiContentArray(input)) {
      return toDatadogMessages(input.map(geminiContentToMessage));
    }
    // Mastra wraps MODEL_GENERATION input as { messages, schema? } and Gemini
    // request bodies use { contents }. Unwrap so we don't bury the message array
    // inside a single stringified user-message content (double-encoded JSON).
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      if (isMessageArray((input as any).messages)) {
        return toDatadogMessages((input as any).messages);
      }
      if (isGeminiContentArray((input as any).messages)) {
        return toDatadogMessages((input as any).messages.map(geminiContentToMessage));
      }
      if (isGeminiContentArray((input as any).contents)) {
        return toDatadogMessages((input as any).contents.map(geminiContentToMessage));
      }
    }
    // String input becomes user message
    if (typeof input === 'string') {
      return toDatadogMessages([{ role: 'user', content: input }]);
    }
    // Object input gets stringified as user message
    return toDatadogMessages([{ role: 'user', content: safeStringify(input) }]);
  }

  // Non-model spans: pass through strings/arrays, stringify objects
  if (typeof input === 'string' || Array.isArray(input)) return input;
  return safeStringify(input);
}

/**
 * Formats output data for Datadog annotations.
 * Model spans use message array format; others use raw or stringified data.
 */
export function formatOutput(output: any, spanType: SpanType): any {
  // Model spans expect {role, content}[] format
  if (isModelDataSpan(spanType)) {
    // Already in message format
    if (isMessageArray(output)) {
      return toDatadogMessages(output);
    }
    // String output becomes assistant message
    if (typeof output === 'string') {
      return [{ role: 'assistant', content: output }];
    }
    // AI SDK shape: { text, object, reasoning, toolCalls, ... }.
    // Prefer structured tool-call messages when present so Datadog renders
    // them as tool-call blocks instead of escaped JSON or text summaries.
    if (output && typeof output === 'object') {
      if (Array.isArray(output.toolCalls) && output.toolCalls.length > 0) {
        return [
          {
            role: 'assistant',
            content: typeof output.text === 'string' ? output.text : '',
            toolCalls: toDatadogToolCalls(output.toolCalls),
          },
        ];
      }
      if (typeof output.text === 'string' && output.text.length > 0) {
        return [{ role: 'assistant', content: output.text }];
      }
      if (output.object !== undefined) {
        return [{ role: 'assistant', content: safeStringify(output.object) }];
      }
    }
    // Other objects get stringified as assistant message
    return [{ role: 'assistant', content: safeStringify(output) }];
  }

  // Non-model spans: pass through strings, stringify objects
  if (typeof output === 'string') return output;
  return safeStringify(output);
}
