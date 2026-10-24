import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { useLoopScenarioAimock } from '../loop/test-utils/aimock/aimock-scenario';
import { MockMemory } from '../memory/mock';
import { InMemoryStore } from '../storage/mock';
import { createTool } from '../tools';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

describe('AgentController savePerStep', () => {
  const getMock = useLoopScenarioAimock();

  async function runTwoStepTurn(savePerStep?: boolean) {
    const storage = new InMemoryStore();
    let threadId = '';
    // What a crash during step 2 would leave behind: the thread's stored messages at that moment.
    let storedDuringStep2: string[] = [];

    const inspect = createTool({
      id: 'inspect',
      description: 'Inspect the page.',
      inputSchema: z.object({}),
      execute: async () => {
        const memoryStore = await storage.getStore('memory');
        const { messages } = await memoryStore!.listMessages({ threadId });
        storedDuringStep2 = messages.map(message => `${message.role}:${JSON.stringify(message.content)}`);
        return { ok: true };
      },
    });
    const open = createTool({
      id: 'open',
      description: 'Open the page.',
      inputSchema: z.object({}),
      execute: async () => ({ opened: true }),
    });

    const llm = getMock();
    llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { toolCalls: [{ id: 'call_open', name: 'open', arguments: {} }] });
    llm.on(
      { endpoint: 'chat', sequenceIndex: 1 },
      { toolCalls: [{ id: 'call_inspect', name: 'inspect', arguments: {} }] },
    );
    llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Done.' });

    const openai = createOpenAI({ apiKey: 'aimock', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    const agent = new Agent({
      id: 'save-per-step-agent',
      name: 'save-per-step-agent',
      instructions: 'You are a test agent.',
      model: openai('gpt-4o-mini'),
      tools: { open, inspect },
    });
    const controller = new AgentController({
      id: 'save-per-step-controller',
      workspace: createMockWorkspace(),
      storage,
      memory: new MockMemory({ storage }),
      initialState: { yolo: true } as any,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
      ...(savePerStep === undefined ? {} : { savePerStep }),
    });
    await controller.init();
    const session = await controller.createSession({ id: 'session', ownerId: 'owner', createInitialThread: true });
    threadId = session.thread.getId()!;

    await session.sendMessage({ content: 'open the page and inspect it' });

    const memoryStore = await storage.getStore('memory');
    const storedAfterTurn = (await memoryStore!.listMessages({ threadId })).messages;
    return { storedDuringStep2, storedAfterTurn, requests: llm.getRequests() };
  }

  it('does not save during the run by default', async () => {
    const { storedDuringStep2, storedAfterTurn, requests } = await runTwoStepTurn();

    expect(requests).toHaveLength(3);
    expect(storedDuringStep2.some(message => message.includes('call_open'))).toBe(false);
    // The whole turn is still saved once the run ends.
    expect(JSON.stringify(storedAfterTurn.map(message => message.content))).toContain('call_open');
  });

  it('saves each finished step when savePerStep is enabled, so a mid-run crash keeps earlier steps', async () => {
    const { storedDuringStep2, storedAfterTurn, requests } = await runTwoStepTurn(true);

    expect(requests).toHaveLength(3);
    // The user message is stored as a user signal.
    expect(storedDuringStep2.some(message => message.includes('open the page and inspect it'))).toBe(true);
    expect(storedDuringStep2.some(message => message.startsWith('assistant:') && message.includes('call_open'))).toBe(
      true,
    );
    expect(JSON.stringify(storedAfterTurn.map(message => message.content))).toContain('Done.');
  });
});
