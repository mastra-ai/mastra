// @ts-nocheck

import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({
  baseUrl: 'http://localhost:3000',
});

const threadId = 'thread-12345';
const agentId = 'agent-67890';

const otherThreadId = 'thread-54321';
const otherAgentId = 'agent-09876';

const threadOne = await client.getMemoryThread({
  threadId,
  agentId
});

const threadTwo = await client.getMemoryThread({
  threadId: otherThreadId,
  agentId: otherAgentId
});
