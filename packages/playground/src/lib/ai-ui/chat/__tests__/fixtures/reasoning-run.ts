import type { RouteResponse } from '@mastra/client-js';
import { ChunkFrom } from '@mastra/core/stream';
import type { ChunkType } from '@mastra/core/stream';

export const abortedThread: RouteResponse<'POST /agents/:agentId/threads/abort'> = { aborted: true };

export const reasoningRunChunks = (runId: string, messageId: string): ChunkType[] => [
  { type: 'start', runId, from: ChunkFrom.AGENT, payload: { messageId } },
  { type: 'reasoning-start', runId, from: ChunkFrom.AGENT, payload: { id: `${messageId}-reasoning` } },
  {
    type: 'reasoning-delta',
    runId,
    from: ChunkFrom.AGENT,
    payload: { id: `${messageId}-reasoning`, text: 'Weighing the rollout order' },
  },
];

export const reasoningRunFailure = (runId: string): ChunkType => ({
  type: 'error',
  runId,
  from: ChunkFrom.AGENT,
  payload: { error: 'Provider overloaded' },
});
