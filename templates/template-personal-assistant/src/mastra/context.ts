import type { Agent } from '@mastra/core/agent';

// Missing or foreign identities are distinct from native memory/storage failures.
export async function findOwnerThread(agent: Agent, ownerId: string, threadId?: string, resourceId?: string) {
  if (!threadId || resourceId !== ownerId) return null;
  const memory = await agent.getMemory();
  if (!memory) throw new Error('Conversation memory is unavailable.');
  const thread = await memory.getThreadById({ threadId });
  return thread?.resourceId === ownerId ? thread : null;
}
