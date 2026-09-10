import type { MastraClient, McpServerListResponse } from '@mastra/client-js';

export const noMcpServers: McpServerListResponse = { servers: [], next: null, total_count: 0 };

type AgentClient = ReturnType<MastraClient['getAgent']>;

export const abortedThread: Awaited<ReturnType<AgentClient['abortThread']>> = { aborted: true };

export const acceptedMessage = (runId: string): Awaited<ReturnType<AgentClient['queueMessage']>> => ({
  accepted: true,
  runId,
});
