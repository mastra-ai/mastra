import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function createHeldAgent() {
  const modelCalled = Promise.withResolvers<void>();
  const modelReleased = Promise.withResolvers<void>();
  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage });
  const agent = new Agent({
    id: 'history-agent',
    name: 'history agent',
    instructions: 'Reply briefly.',
    memory,
    model: new MastraLanguageModelV2Mock({
      doStream: async () => {
        modelCalled.resolve();
        return {
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({ type: 'response-metadata', id: 'res', modelId: 'mock', timestamp: new Date(0) });
              controller.enqueue({ type: 'text-start', id: 'text' });
              controller.enqueue({ type: 'text-delta', id: 'text', delta: 'on it' });
              await modelReleased.promise;
              controller.enqueue({ type: 'text-end', id: 'text' });
              controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
              controller.close();
            },
          }),
        };
      },
    }),
  });
  const mastra = new Mastra({ agents: { 'history-agent': agent }, logger: false, storage });
  const roles = async (threadId: string) => {
    const { messages } = await memory.recall({ threadId });
    return messages.map(message => message.role).sort();
  };
  return {
    agent: mastra.getAgent('history-agent'),
    storage,
    roles,
    modelCalled: modelCalled.promise,
    releaseModel: modelReleased.resolve,
  };
}

// A chat session (Factory, MastraCode) sends each message as a `user` signal. Reloading the chat
// while the agent works on the first message rebuilds the transcript from stored history.
// Engine and timing variants live in sent-message-history.scenario.test.ts.
describe('a sent message in thread history', () => {
  it('is stored while its first model call is still running', async () => {
    const { agent, storage, roles, modelCalled, releaseModel } = createHeldAgent();
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'history-controller',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'history-session', ownerId: 'owner-1' });
    await session.thread.create();
    const threadId = session.thread.requireId();

    const sent = session.sendMessage({ content: 'build the login page' });
    await modelCalled;

    expect(await roles(threadId)).toEqual(['signal']);

    releaseModel();
    await sent;
    await vi.waitFor(async () => expect(await roles(threadId)).toEqual(['assistant', 'signal']));
  });
});
