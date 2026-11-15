import type { DatasetExperimentResult, MastraClient } from '@mastra/client-js';

export const replayResult = {
  input: [
    { role: 'user', content: { parts: [{ type: 'text', text: 'Previous question' }] } },
    { role: 'user', content: { parts: [{ type: 'text', text: 'Check my order' }] } },
  ],
  groundTruth: 'Order ready',
  output: {
    text: 'Please confirm the order number',
    replay: {
      sourceThreadId: 'golden',
      turnIndex: 2,
      turnCount: 10,
      memorySeed: { workingMemory: 'Ada' },
      expectedTrajectory: {
        steps: [{ name: 'lookupOrder', toolArgs: { orderId: 3 }, toolResult: { status: 'ready' } }],
      },
    },
    toolCalls: [
      { runId: 'internal-run-id', payload: { toolCallId: 'call', toolName: 'lookupOrder', args: { orderId: 99 } } },
    ],
    toolResults: [{ payload: { toolCallId: 'call', result: { error: 'No recorded result' } } }],
    workingMemory: 'Ada: awaiting confirmation',
  },
  toolMockReport: {
    matchMode: 'lookup',
    served: [],
    liveCalls: [],
    unconsumed: [{ mockIndex: 0, toolName: 'lookupOrder', args: { orderId: 3 } }],
    misses: [{ toolName: 'lookupOrder', args: { orderId: 99 }, reason: 'args-mismatch', closestArgs: { orderId: 3 } }],
  },
} satisfies Pick<DatasetExperimentResult, 'input' | 'output' | 'groundTruth' | 'toolMockReport'>;

export const conversationResult = {
  input: {
    type: 'conversation',
    turns: [{ input: 'Remember Ada' }, { input: 'Check my order' }, { input: 'Has it shipped?' }],
  },
  groundTruth: null,
  output: {
    replay: { mode: 'conversation', sourceThreadId: 'golden', turnCount: 3 },
    turns: [
      {
        turnIndex: 0,
        input: [{ role: 'user', content: { parts: [{ type: 'text', text: 'Remember Ada' }] } }],
        groundTruth: 'Remembered Ada',
        output: { text: 'Remembered Grace', workingMemory: 'Grace' },
        scores: [{ scorerId: 'similarity', scorerName: 'Similarity', score: 0, reason: null, error: null }],
        traceId: 'trace-one',
        durationMs: 10,
        error: null,
        workingMemoryBefore: 'Unknown',
      },
      {
        turnIndex: 1,
        input: replayResult.input,
        groundTruth: replayResult.groundTruth,
        expectedTrajectory: replayResult.output.replay.expectedTrajectory,
        output: replayResult.output,
        toolMockReport: replayResult.toolMockReport,
        workingMemoryBefore: 'Grace',
        scores: [
          { scorerId: 'similarity', scorerName: 'Similarity', score: null, reason: null, error: 'Judge unavailable' },
        ],
        traceId: 'trace-two',
        durationMs: 10,
        error: { message: 'Provider disconnected' },
      },
    ],
    error: { message: 'Provider disconnected' },
  },
  toolMockReport: replayResult.toolMockReport,
} satisfies Pick<DatasetExperimentResult, 'input' | 'output' | 'groundTruth' | 'toolMockReport'>;

export const noMcpServers: Awaited<ReturnType<MastraClient['getMcpServers']>> = { servers: [], totalCount: 0 };

/** Caller-run experiments (including the NFL demo) save tool payloads directly. */
export const flatConversationResult = {
  ...conversationResult,
  output: {
    ...conversationResult.output,
    replay: { ...conversationResult.output.replay, turnCount: 1 },
    turns: [
      {
        ...conversationResult.output.turns[1],
        turnIndex: 0,
        output: {
          ...replayResult.output,
          toolCalls: replayResult.output.toolCalls.map(call => call.payload),
          toolResults: replayResult.output.toolResults.map(result => result.payload),
        },
      },
    ],
  },
} satisfies Pick<DatasetExperimentResult, 'input' | 'output' | 'groundTruth' | 'toolMockReport'>;

export const unstartedConversationResult = {
  ...conversationResult,
  output: { ...conversationResult.output, turns: [], error: { message: 'Memory is required' } },
} satisfies Pick<DatasetExperimentResult, 'input' | 'output' | 'groundTruth' | 'toolMockReport'>;

export const structuredConversationResult = {
  ...flatConversationResult,
  output: {
    ...flatConversationResult.output,
    error: null,
    turns: [{ turnIndex: 0, input: 'Check my order', output: { object: { status: 'ready' } } }],
  },
} satisfies Pick<DatasetExperimentResult, 'input' | 'output' | 'groundTruth' | 'toolMockReport'>;
