import type { MastraClient } from '@mastra/client-js';

type AgentClient = ReturnType<MastraClient['getAgent']>;

export const abortedThread: Awaited<ReturnType<AgentClient['abortThread']>> = { aborted: true };

export const acceptedMessage = (runId: string): Awaited<ReturnType<AgentClient['queueMessage']>> => ({
  accepted: true,
  runId,
});
