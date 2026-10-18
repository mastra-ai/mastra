import type { StreamVNextChunkType } from '@mastra/client-js';
import { completedLoop } from './completed-loop';

export const runningChunk: StreamVNextChunkType = {
  type: 'workflow-start',
  runId: 'live-run',
  from: 'WORKFLOW',
  payload: { workflowId: 'two-step-workflow' },
};

export const completedChunks: StreamVNextChunkType[] = [
  runningChunk,
  {
    type: 'workflow-step-result',
    runId: 'live-run',
    from: 'WORKFLOW',
    payload: {
      id: 'analyze-document[0].count-words',
      stepCallId: 'count-words-call',
      ...completedLoop.steps['analyze-document[0].count-words'],
    },
  },
  {
    type: 'workflow-finish',
    runId: 'live-run',
    from: 'WORKFLOW',
    payload: {
      workflowStatus: 'success',
      output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
      metadata: {},
    },
  },
];

export const replayedChunks: StreamVNextChunkType[] = completedChunks.map(chunk => ({
  ...chunk,
  runId: completedLoop.runId,
  ...(chunk.type === 'workflow-step-result' ? { payload: { ...chunk.payload, output: { words: 9 } } } : {}),
}));
