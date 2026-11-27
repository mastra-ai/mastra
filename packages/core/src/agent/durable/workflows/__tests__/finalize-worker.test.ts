import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { AgentController } from '../../../../agent-controller/agent-controller';
import { Mastra } from '../../../../mastra';
import { MockMemory } from '../../../../memory/mock';
import { RequestContext } from '../../../../request-context';
import { InMemoryStore } from '../../../../storage';
import { createMockModel } from '../../../../test-utils/llm-mock';
import { Agent } from '../../../agent';
import { MessageList } from '../../../message-list';
import { runDurableFinishSideEffects } from '../finalize-run';

it('saves the reply when a cold finalizer rebuilds the controller toolset', async () => {
  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage });
  const agent = new Agent({
    id: 'agent',
    name: 'Agent',
    instructions: 'Help.',
    model: createMockModel({ mockText: 'unused' }),
    memory,
  });
  const controller = new AgentController({
    id: 'controller',
    storage,
    agent,
    modes: [{ id: 'build', name: 'Build', default: true, defaultModelId: 'openai/gpt-4o' }],
  });
  const mastra = new Mastra({ agents: { agent }, agentControllers: { controller }, storage, logger: false });
  try {
    const threadId = 'thread';
    const resourceId = 'resource';
    const runId = randomUUID();
    await memory.createThread({ threadId, resourceId });
    // Simulate a terminal step on a worker with no earlier steps in its local registry.
    const requestContext = await controller.__restoreWorkerRequestContext(
      new RequestContext(),
      {
        controllerId: controller.id,
        agentId: agent.id,
        sessionId: 'session',
        ownerId: 'owner',
        resourceId,
        threadId,
        modeId: 'build',
      },
      new AbortController().signal,
      runId,
    );
    const list = new MessageList({ threadId, resourceId });
    list.add({ role: 'user', content: 'Finish this turn.' }, 'user');
    list.add({ role: 'assistant', content: 'Finished on the cold worker.' }, 'response');
    const messageListState = list.serialize();
    await runDurableFinishSideEffects({
      mastra,
      runId,
      requestContext,
      messageListState,
      initData: {
        __workflowKind: 'durable-agent',
        agentId: agent.id,
        runId,
        messageId: 'reply',
        messageListState,
        toolsMetadata: [],
        modelConfig: { provider: 'openai', modelId: 'gpt-4o' },
        options: { toolsetToolNames: ['ask_user'] },
        requestContextEntries: { controller: { controllerId: controller.id } },
        state: { resourceId, threadId, threadExists: true },
      },
    });
    const { messages } = await memory.recall({ threadId, resourceId });
    expect(JSON.stringify(messages.filter(message => message.role === 'assistant'))).toContain(
      'Finished on the cold worker.',
    );
  } finally {
    await mastra.shutdown();
  }
});
