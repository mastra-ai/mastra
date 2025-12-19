/**
 * Utility functions for Datadog LLM Observability Exporter
 */

import tracer from 'dd-trace';
import { SpanType } from '@mastra/core/observability';

/**
 * Datadog LLM Observability span kinds.
 */
export type DatadogSpanKind = 'llm' | 'agent' | 'workflow' | 'tool' | 'task' | 'retrieval' | 'embedding';

/**
 * Maps Mastra SpanTypes to Datadog LLMObs span kinds.
 */
export const SPAN_TYPE_TO_KIND: Record<SpanType, DatadogSpanKind> = {
  [SpanType.AGENT_RUN]: 'agent',
  [SpanType.MODEL_GENERATION]: 'workflow',
  [SpanType.MODEL_STEP]: 'llm',
  [SpanType.MODEL_CHUNK]: 'task',
  [SpanType.TOOL_CALL]: 'tool',
  [SpanType.MCP_TOOL_CALL]: 'tool',
  [SpanType.WORKFLOW_RUN]: 'workflow',
  [SpanType.WORKFLOW_STEP]: 'task',
  [SpanType.WORKFLOW_CONDITIONAL]: 'task',
  [SpanType.WORKFLOW_CONDITIONAL_EVAL]: 'task',
  [SpanType.WORKFLOW_PARALLEL]: 'task',
  [SpanType.WORKFLOW_LOOP]: 'task',
  [SpanType.WORKFLOW_SLEEP]: 'task',
  [SpanType.WORKFLOW_WAIT_EVENT]: 'task',
  [SpanType.PROCESSOR_RUN]: 'task',
  [SpanType.GENERIC]: 'task',
};

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
 * Returns the Datadog kind for a Mastra span type.
 */
export function kindFor(spanType: SpanType): DatadogSpanKind {
  return SPAN_TYPE_TO_KIND[spanType] || 'task';
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
    return JSON.stringify(data);
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
function isMessageArray(data: any): data is Array<{ role: string; content: any }> {
  return Array.isArray(data) && data.every(m => m?.role && m?.content !== undefined);
}

/**
 * Formats input data for Datadog annotations.
 * LLM spans use message array format; others use raw or stringified data.
 */
export function formatInput(input: any, spanType: SpanType): any {
  // LLM spans expect {role, content}[] format
  if (spanType === SpanType.MODEL_GENERATION || spanType === SpanType.MODEL_STEP) {
    // Already in message format
    if (isMessageArray(input)) {
      return input.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : safeStringify(m.content),
      }));
    }
    // String input becomes user message
    if (typeof input === 'string') {
      return [{ role: 'user', content: input }];
    }
    // Object input gets stringified as user message
    return [{ role: 'user', content: safeStringify(input) }];
  }

  // Non-LLM spans: pass through strings/arrays, stringify objects
  if (typeof input === 'string' || Array.isArray(input)) return input;
  return safeStringify(input);
}

/**
 * Formats output data for Datadog annotations.
 * LLM spans use message array format; others use raw or stringified data.
 */
export function formatOutput(output: any, spanType: SpanType): any {
  // LLM spans expect {role, content}[] format
  if (spanType === SpanType.MODEL_GENERATION || spanType === SpanType.MODEL_STEP) {
    // Already in message format
    if (isMessageArray(output)) {
      return output.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : safeStringify(m.content),
      }));
    }
    // String output becomes assistant message
    if (typeof output === 'string') {
      return [{ role: 'assistant', content: output }];
    }
    // Object with text property (common AI SDK format)
    if (output?.text) {
      return [{ role: 'assistant', content: output.text }];
    }
    // Other objects get stringified as assistant message
    return [{ role: 'assistant', content: safeStringify(output) }];
  }

  // Non-LLM spans: pass through strings, stringify objects
  if (typeof output === 'string') return output;
  return safeStringify(output);
}
