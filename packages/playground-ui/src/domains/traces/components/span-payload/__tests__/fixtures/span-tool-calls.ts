import type { MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';

type GetTraceResponse = Awaited<ReturnType<MastraClient['getTrace']>>;

export const TOOL_CALLS_TRACE_ID = 'trace-tool-calls';

const baseSpan = {
  traceId: TOOL_CALLS_TRACE_ID,
  isEvent: false,
  startedAt: new Date('2026-10-28T09:00:00.000Z'),
  endedAt: new Date('2026-10-28T09:00:01.000Z'),
  createdAt: new Date('2026-10-28T09:00:00.000Z'),
  updatedAt: null,
  status: TraceStatus.SUCCESS,
};

type TraceSpan = GetTraceResponse['spans'][number];

/** A generation that asked for the weather twice, read a missing file, and updated a task list the chat never draws. */
export const toolCallsGenerationSpan: TraceSpan = {
  ...baseSpan,
  spanId: 'generation',
  parentSpanId: 'agent-root',
  name: "llm: 'gpt-5-mini'",
  spanType: SpanType.MODEL_GENERATION,
  attributes: {
    model: 'gpt-5-mini',
    tools: [
      { type: 'function', name: 'weatherInfo', description: 'Gets the weather for a city.' },
      { type: 'function', name: 'readFile', description: 'Reads a file from the workspace.' },
    ],
  },
  input: { messages: [{ role: 'user', content: 'Weather in Paris and London, then read hello.md' }] },
  output: {
    text: 'Paris is overcast, London is drizzly, and hello.md does not exist.',
    toolCalls: [
      { toolCallId: 'call-paris', toolName: 'weatherInfo', args: { location: 'paris' } },
      { toolCallId: 'call-london', toolName: 'weatherInfo', args: { location: 'london' } },
      { toolCallId: 'call-read', toolName: 'readFile', args: { path: 'hello.md' } },
      { toolCallId: 'call-task', toolName: 'task_write', args: { tasks: [] } },
    ],
  },
};

/** The step that asked for those tools; it wrote no text, so its output is only the calls. */
export const toolCallsStepSpan: TraceSpan = {
  ...baseSpan,
  spanId: 'step-0',
  parentSpanId: 'generation',
  name: 'step: 0',
  spanType: SpanType.MODEL_STEP,
  output: {
    text: '',
    toolCalls: [
      { toolCallId: 'call-paris', toolName: 'weatherInfo', args: { location: 'paris' } },
      { toolCallId: 'call-london', toolName: 'weatherInfo', args: { location: 'london' } },
    ],
    finishReason: 'tool-calls',
  },
};

/** The trace around that generation; results live on the tool spans under its step. */
export const toolCallsTrace: GetTraceResponse = {
  traceId: TOOL_CALLS_TRACE_ID,
  spans: [
    {
      ...baseSpan,
      spanId: 'agent-root',
      parentSpanId: null,
      name: "agent run: 'chef'",
      spanType: SpanType.AGENT_RUN,
      entityType: 'agent',
      entityId: 'chef',
      entityName: 'chef',
    },
    toolCallsGenerationSpan,
    toolCallsStepSpan,
    {
      ...baseSpan,
      spanId: 'tool-paris',
      parentSpanId: 'step-0',
      name: "tool: 'weatherInfo'",
      spanType: SpanType.TOOL_CALL,
      entityType: 'tool',
      entityId: 'weatherInfo',
      entityName: 'weatherInfo',
      attributes: { toolCallId: 'call-paris' },
      input: { location: 'paris' },
      output: { conditions: 'Overcast', temperature: 14.3 },
    },
    {
      ...baseSpan,
      spanId: 'tool-london',
      parentSpanId: 'step-0',
      name: "tool: 'weatherInfo'",
      spanType: SpanType.TOOL_CALL,
      entityType: 'tool',
      entityId: 'weatherInfo',
      entityName: 'weatherInfo',
      attributes: { toolCallId: 'call-london' },
      input: { location: 'london' },
      output: { conditions: 'Moderate drizzle', temperature: 14.2 },
    },
    {
      ...baseSpan,
      spanId: 'tool-read',
      parentSpanId: 'step-0',
      name: "tool: 'readFile'",
      spanType: SpanType.TOOL_CALL,
      entityType: 'tool',
      entityId: 'readFile',
      entityName: 'readFile',
      attributes: { toolCallId: 'call-read' },
      input: { path: 'hello.md' },
      error: { message: 'File not found: hello.md' },
    },
  ],
};

/** A generation that only listed its tools for the model and answered without calling any. */
export const noToolCallsGenerationSpan: TraceSpan = {
  ...baseSpan,
  spanId: 'generation-no-calls',
  parentSpanId: 'agent-root',
  name: "llm: 'gpt-5-mini'",
  spanType: SpanType.MODEL_GENERATION,
  attributes: {
    tools: [{ type: 'function', name: 'weatherInfo', description: 'Gets the weather for a city.' }],
  },
  input: { messages: [{ role: 'user', content: 'Hello' }] },
  output: { text: 'Hello! How can I help?' },
};
