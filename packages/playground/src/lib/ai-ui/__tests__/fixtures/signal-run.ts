import type { RouteResponse } from '@mastra/client-js';
import { ChunkFrom } from '@mastra/core/stream';
import type { ChunkType } from '@mastra/core/stream';

const RUN_ID = 'run-1';

export const signalRunStart: ChunkType = { type: 'start', runId: RUN_ID, from: ChunkFrom.AGENT, payload: {} };

export const acceptedSignalMessage: RouteResponse<'POST /agents/:agentId/send-message'> = {
  accepted: true,
  runId: RUN_ID,
};

export const abortedSignalRun: RouteResponse<'POST /agents/:agentId/threads/abort'> = { aborted: true };
