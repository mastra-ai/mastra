import type { GetWorkflowResponse, ListWorkflowRunsResponse, MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';

type GetTraceResponse = Awaited<ReturnType<MastraClient['getTrace']>>;

export const TRACE_THREAD_ITEM_ID = 'trace-thread-item';
export const TRACE_THREAD_ID = 'thread-partial';
export const TRACE_WORKFLOW_ID = 'tripPlanner';
export const TRACE_WORKFLOW_RUN_ID = 'workflow-run-1';

const baseSpan = {
  traceId: TRACE_THREAD_ITEM_ID,
  isEvent: false,
  threadId: TRACE_THREAD_ID,
  startedAt: new Date('2026-08-30T12:00:00.000Z'),
  endedAt: new Date('2026-08-30T12:00:01.000Z'),
  createdAt: new Date('2026-08-30T12:00:00.000Z'),
  updatedAt: null,
  status: TraceStatus.SUCCESS,
};

export const basicAgentTrace: GetTraceResponse = {
  traceId: TRACE_THREAD_ITEM_ID,
  spans: [
    {
      ...baseSpan,
      spanId: 'agent-root',
      parentSpanId: null,
      name: 'Travel agent run',
      spanType: SpanType.AGENT_RUN,
      entityType: 'agent',
      entityId: 'travel-agent',
      entityName: 'Travel Agent',
      input: {
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Plan a weekend in Paris' }] }],
      },
      output: { text: 'Your Paris itinerary is ready.' },
    },
  ],
};

const rootSpan = basicAgentTrace.spans[0];

export const agentTraceWithTools: GetTraceResponse = {
  traceId: TRACE_THREAD_ITEM_ID,
  spans: [
    rootSpan,
    {
      ...baseSpan,
      spanId: 'model-generation',
      parentSpanId: 'agent-root',
      name: 'Model generation',
      spanType: SpanType.MODEL_GENERATION,
      startedAt: new Date('2026-08-30T12:00:00.100Z'),
    },
    {
      ...baseSpan,
      spanId: 'workflow-tool',
      parentSpanId: 'model-generation',
      name: 'Trip planner workflow',
      spanType: SpanType.TOOL_CALL,
      entityType: 'tool',
      entityId: 'workflow-tripPlanner',
      entityName: 'workflow-tripPlanner',
      input: { inputData: { city: 'Paris' } },
      output: { runId: TRACE_WORKFLOW_RUN_ID, result: { days: 2 } },
      attributes: { toolCallId: 'call-workflow' },
      startedAt: new Date('2026-08-30T12:00:00.200Z'),
    },
    {
      ...baseSpan,
      spanId: 'workflow-run',
      parentSpanId: 'workflow-tool',
      name: 'Trip planner run',
      spanType: SpanType.WORKFLOW_RUN,
      entityType: 'workflow_run',
      entityId: 'tripPlanner',
      entityName: 'Trip planner',
      startedAt: new Date('2026-08-30T12:00:00.210Z'),
    },
    {
      ...baseSpan,
      spanId: 'nested-workflow-tool',
      parentSpanId: 'workflow-run',
      name: 'Internal weather lookup',
      spanType: SpanType.TOOL_CALL,
      entityType: 'tool',
      entityId: 'internalWeather',
      entityName: 'internalWeather',
      input: { city: 'Paris' },
      output: { temperature: 22 },
      attributes: { toolCallId: 'call-internal' },
      startedAt: new Date('2026-08-30T12:00:00.220Z'),
    },
    {
      ...baseSpan,
      spanId: 'mcp-tool',
      parentSpanId: 'model-generation',
      name: 'Hotel search',
      spanType: SpanType.MCP_TOOL_CALL,
      entityType: 'tool',
      entityId: 'searchHotels',
      entityName: 'searchHotels',
      input: { city: 'Paris' },
      output: { hotels: ['Left Bank'] },
      attributes: { mcpServer: 'travel', toolCallId: 'call-mcp' },
      startedAt: new Date('2026-08-30T12:00:00.300Z'),
    },
    {
      ...baseSpan,
      spanId: 'client-tool',
      parentSpanId: 'model-generation',
      name: 'Client location',
      spanType: SpanType.CLIENT_TOOL_CALL,
      entityType: 'tool',
      entityId: 'browser_location',
      entityName: 'browser_location',
      input: { permission: true },
      output: { city: 'Paris' },
      startedAt: new Date('2026-08-30T12:00:00.400Z'),
    },
    {
      ...baseSpan,
      spanId: 'provider-tool',
      parentSpanId: 'model-generation',
      name: 'Provider web search',
      spanType: SpanType.PROVIDER_TOOL_CALL,
      entityType: 'tool',
      entityId: 'web_search',
      entityName: 'web_search',
      input: { query: 'Paris events' },
      output: { events: ['Exhibition'] },
      attributes: { toolCallId: 'call-provider' },
      startedAt: new Date('2026-08-30T12:00:00.500Z'),
    },
  ],
};

export const agentTraceWithSkill: GetTraceResponse = {
  traceId: TRACE_THREAD_ITEM_ID,
  spans: [
    rootSpan,
    {
      ...baseSpan,
      spanId: 'skill-model-generation',
      parentSpanId: 'agent-root',
      name: 'Model generation',
      spanType: SpanType.MODEL_GENERATION,
      startedAt: new Date('2026-08-30T12:00:00.100Z'),
    },
    {
      ...baseSpan,
      spanId: 'skill-tool',
      parentSpanId: 'skill-model-generation',
      name: 'Activate skill',
      spanType: SpanType.TOOL_CALL,
      entityType: 'tool',
      entityId: 'skill',
      entityName: 'skill',
      input: { name: 'trip-planning' },
      output: { content: 'Skill loaded' },
      attributes: { toolCallId: 'call-skill' },
      startedAt: new Date('2026-08-30T12:00:00.200Z'),
    },
  ],
};

export const traceWorkflow = {
  name: 'Trip planner workflow',
  stepGraph: [{ type: 'step', step: { id: 'build-itinerary', description: '' } }],
} satisfies Pick<GetWorkflowResponse, 'name' | 'stepGraph'>;

type WorkflowRunSnapshot = Exclude<ListWorkflowRunsResponse['runs'][number]['snapshot'], string>;

const workflowRunDate = new Date('2026-08-30T12:00:00.200Z');

export const traceWorkflowRuns: ListWorkflowRunsResponse = {
  runs: [
    {
      workflowName: traceWorkflow.name,
      runId: TRACE_WORKFLOW_RUN_ID,
      snapshot: {
        runId: TRACE_WORKFLOW_RUN_ID,
        status: 'success',
        value: {},
        context: {},
        serializedStepGraph: traceWorkflow.stepGraph,
        activePaths: [],
        activeStepsPath: {},
        suspendedPaths: {},
        resumeLabels: {},
        waitingPaths: {},
        timestamp: workflowRunDate.getTime(),
      } satisfies WorkflowRunSnapshot,
      createdAt: workflowRunDate,
      updatedAt: workflowRunDate,
    },
  ],
  total: 1,
};
