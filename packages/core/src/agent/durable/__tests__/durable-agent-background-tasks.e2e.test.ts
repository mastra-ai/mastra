/**
 * DurableAgent Background Tasks E2E Tests
 *
 * Mirrors background-tasks.e2e.test.ts 1:1 but uses createDurableAgent
 * wrapping a real Agent with OpenAI model. Skips if OPENAI_API_KEY is absent.
 */

import { createOpenAI } from '@ai-sdk/openai-v5';
import { config } from 'dotenv';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { MockStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

config();

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

const describeE2E = process.env.OPENAI_API_KEY ? describe : describe.skip;

const testStorage = new MockStore();

describeE2E('DurableAgent Background Tasks E2E', () => {
  let mastra: Mastra;

  const researchTool = createTool({
    id: 'research',
    description: 'Research a topic. This takes a while, use it when the user asks to research something.',
    inputSchema: z.object({
      topic: z.string().describe('The topic to research'),
    }),
    outputSchema: z.object({
      summary: z.string(),
    }),
    execute: async ({ topic }) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return { summary: `Research complete on "${topic}": This is a comprehensive summary.` };
    },
    background: { enabled: true },
  });

  const greetTool = createTool({
    id: 'greet',
    description: 'Greet a person by name. Use this when the user asks to greet someone.',
    inputSchema: z.object({
      name: z.string().describe('The name to greet'),
    }),
    outputSchema: z.object({
      greeting: z.string(),
    }),
    execute: async ({ name }) => {
      return { greeting: `Hello, ${name}!` };
    },
  });

  const baseAgent = new Agent({
    id: 'bg-e2e-agent',
    name: 'Background E2E Agent',
    instructions:
      'You are a helpful assistant with access to tools. ' +
      'When asked to research something, use the research tool. ' +
      'When asked to greet someone, use the greet tool.',
    model: openai('gpt-4o-mini'),
    tools: { research: researchTool, greet: greetTool },
    backgroundTasks: {
      tools: {
        research: true,
      },
    },
  });

  const durableAgent = createDurableAgent({ agent: baseAgent });

  beforeEach(() => {
    mastra = new Mastra({
      agents: { 'bg-e2e-agent': durableAgent as any },
      backgroundTasks: {
        enabled: true,
        globalConcurrency: 5,
        perAgentConcurrency: 3,
      },
      storage: testStorage,
    });
  });

  afterEach(async () => {
    const manager = mastra.backgroundTaskManager;
    if (manager) {
      await manager.shutdown();
    }
    const backgroundTasksStore = await testStorage.getStore('backgroundTasks');
    await backgroundTasksStore?.dangerouslyClearAll();
  });

  it('dispatches a background-eligible tool and returns a placeholder', async () => {
    const result = await durableAgent.stream('Please research the topic "quantum computing"');

    const chunks: any[] = [];
    for await (const chunk of result.fullStream) {
      chunks.push(chunk);
    }

    const bgStarted = chunks.find(c => c.type === 'background-task-started');
    expect(bgStarted).toBeDefined();
    expect(bgStarted.payload.toolName).toBe('research');
    expect(bgStarted.payload.taskId).toBeDefined();

    const fullOutput = await result.output.getFullOutput();
    expect(fullOutput.text).toBeDefined();
    expect(fullOutput.text.length).toBeGreaterThan(0);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const manager = mastra.backgroundTaskManager!;
    const tasks = await manager.listTasks({ toolName: 'research' });
    expect(tasks.total).toBeGreaterThan(0);

    const task = tasks.tasks[0]!;
    expect(task.status).toBe('completed');
    expect(task.result).toBeDefined();
    expect((task.result as any).summary).toContain('quantum computing');

    result.cleanup();
  }, 30_000);

  it('runs a foreground tool normally', async () => {
    const result = await durableAgent.stream('Please greet someone named Alice');

    const chunks: any[] = [];
    for await (const chunk of result.fullStream) {
      chunks.push(chunk);
    }

    const bgStarted = chunks.find(c => c.type === 'background-task-started');
    expect(bgStarted).toBeUndefined();

    const toolResult = chunks.find(c => c.type === 'tool-result' && c.payload?.toolName === 'greet');
    expect(toolResult).toBeDefined();

    const fullOutput = await result.output.getFullOutput();
    expect(fullOutput.text).toBeDefined();
    expect(fullOutput.text.toLowerCase()).toContain('alice');

    result.cleanup();
  }, 30_000);

  it('background task completes and result can be queried', async () => {
    const result = await durableAgent.stream('Research "artificial intelligence" for me');

    const chunks: any[] = [];
    for await (const chunk of result.fullStream) {
      chunks.push(chunk);
    }

    const bgStarted = chunks.find(c => c.type === 'background-task-started');
    expect(bgStarted).toBeDefined();
    const taskId = bgStarted.payload.taskId;

    await new Promise(resolve => setTimeout(resolve, 1500));

    const manager = mastra.backgroundTaskManager!;
    const task = await manager.getTask(taskId);
    expect(task).toBeDefined();
    expect(task!.status).toBe('completed');
    expect((task!.result as any).summary).toContain('artificial intelligence');

    result.cleanup();
  }, 30_000);

  it('emits background-task-started chunk on the stream after task dispatches', async () => {
    const result = await durableAgent.stream('Research "machine learning" please');

    const chunks: any[] = [];
    for await (const chunk of result.fullStream) {
      chunks.push(chunk);
    }

    await new Promise(resolve => setTimeout(resolve, 1500));

    const started = chunks.find(c => c.type === 'background-task-started');
    expect(started).toBeDefined();
    expect(started.payload.toolName).toBe('research');

    const manager = mastra.backgroundTaskManager!;
    const tasks = await manager.listTasks({ toolName: 'research', status: 'completed' });
    expect(tasks.total).toBeGreaterThan(0);

    result.cleanup();
  }, 30_000);

  it('background task works alongside memory — second prompt processes while bg task runs', async () => {
    const mockMemory = new MockMemory();
    const threadId = 'durable-bg-memory-test-thread';
    const resourceId = 'durable-bg-memory-test-user';

    const memoryBaseAgent = new Agent({
      id: 'durable-bg-memory-agent',
      name: 'Durable Background Memory Agent',
      instructions:
        'You are a helpful assistant. ' +
        'When asked to research something, use the research tool. ' +
        'When asked to greet someone, use the greet tool. ' +
        'Always respond concisely.',
      model: openai('gpt-4o-mini'),
      tools: { research: researchTool, greet: greetTool },
      memory: mockMemory,
      backgroundTasks: {
        tools: { research: true },
      },
    });

    const memoryDurableAgent = createDurableAgent({ agent: memoryBaseAgent });

    const memoryMastra = new Mastra({
      agents: { 'durable-bg-memory-agent': memoryDurableAgent as any },
      backgroundTasks: {
        enabled: true,
        globalConcurrency: 5,
        perAgentConcurrency: 3,
      },
      storage: testStorage,
    });

    try {
      const stream1 = await memoryDurableAgent.stream('Please research "neural networks" for me', {
        memory: { thread: threadId, resource: resourceId },
      });

      const chunks1: any[] = [];
      for await (const chunk of stream1.fullStream) {
        chunks1.push(chunk);
      }

      const bgStarted = chunks1.find(c => c.type === 'background-task-started');
      expect(bgStarted).toBeDefined();
      expect(bgStarted.payload.toolName).toBe('research');

      stream1.cleanup();

      const stream2 = await memoryDurableAgent.stream('Now greet someone named Bob', {
        memory: { thread: threadId, resource: resourceId },
      });

      const chunks2: any[] = [];
      for await (const chunk of stream2.fullStream) {
        chunks2.push(chunk);
      }

      const bgStarted2 = chunks2.find(c => c.type === 'background-task-started');
      expect(bgStarted2).toBeUndefined();

      const toolResult2 = chunks2.find(c => c.type === 'tool-result' && c.payload?.toolName === 'greet');
      expect(toolResult2).toBeDefined();

      const fullOutput2 = await stream2.output.getFullOutput();
      expect(fullOutput2.text.toLowerCase()).toContain('bob');

      stream2.cleanup();

      await new Promise(resolve => setTimeout(resolve, 2000));

      const manager = memoryMastra.backgroundTaskManager!;
      const tasks = await manager.listTasks({ toolName: 'research', status: 'completed' });
      expect(tasks.total).toBeGreaterThan(0);
      expect((tasks.tasks[0]!.result as any).summary).toContain('neural networks');

      const { messages } = await mockMemory.recall({
        threadId,
        resourceId,
      });

      expect(messages.length).toBeGreaterThan(0);

      const userMessages = messages.filter((m: any) => m.role === 'user');
      expect(userMessages.length).toBeGreaterThanOrEqual(2);

      const assistantMessages = messages.filter((m: any) => m.role === 'assistant');
      expect(assistantMessages.length).toBeGreaterThanOrEqual(2);

      const allContent = messages
        .map((m: any) => {
          if (typeof m.content === 'string') return m.content;
          if (Array.isArray(m.content)) {
            return m.content.map((p: any) => p.text || p.result || JSON.stringify(p)).join(' ');
          }
          return JSON.stringify(m.content);
        })
        .join(' ')
        .toLowerCase();

      expect(allContent).toContain('neural networks');
      expect(allContent).toContain('bob');
    } finally {
      await memoryMastra.backgroundTaskManager?.shutdown();
    }
  }, 60_000);

  it('streamUntilIdle keeps the stream open and continues after a background task completes', async () => {
    const mockMemory = new MockMemory();
    const threadId = 'durable-stream-until-idle-thread-1';
    const resourceId = 'durable-stream-until-idle-user-1';

    const memoryBaseAgent = new Agent({
      id: 'durable-stream-until-idle-agent-1',
      name: 'Durable Stream Until Idle Agent',
      instructions:
        'You are a helpful assistant. ' +
        'When asked to research something, use the research tool. ' +
        'After you see the research result, briefly summarize it for the user.',
      model: openai('gpt-4o-mini'),
      tools: { research: researchTool, greet: greetTool },
      memory: mockMemory,
      backgroundTasks: { tools: { research: true } },
    });

    const memoryDurableAgent = createDurableAgent({ agent: memoryBaseAgent });

    const memoryMastra = new Mastra({
      agents: { 'durable-stream-until-idle-agent-1': memoryDurableAgent as any },
      backgroundTasks: {
        enabled: true,
        globalConcurrency: 5,
        perAgentConcurrency: 3,
      },
      storage: testStorage,
    });

    try {
      const result = await memoryDurableAgent.streamUntilIdle('Please research "quantum computing" for me', {
        memory: { thread: threadId, resource: resourceId },
      });

      const chunks: any[] = [];
      for await (const chunk of result.fullStream) {
        chunks.push(chunk);
      }

      const bgStarted = chunks.find(c => c.type === 'background-task-started');
      expect(bgStarted).toBeDefined();
      expect(bgStarted.payload.toolName).toBe('research');

      const bgCompleted = chunks.find(c => c.type === 'background-task-completed');
      expect(bgCompleted).toBeDefined();
      expect(bgCompleted.payload.taskId).toBe(bgStarted.payload.taskId);

      const finishes = chunks.filter(c => c.type === 'finish');
      expect(finishes.length).toBeGreaterThanOrEqual(2);

      const manager = memoryMastra.backgroundTaskManager!;
      const tasks = await manager.listTasks({ toolName: 'research', status: 'completed' });
      expect(tasks.total).toBeGreaterThan(0);
      expect((tasks.tasks[0]!.result as any).summary).toContain('quantum computing');

      const assembledText = chunks
        .filter(c => c?.type === 'text-delta')
        .map(c => c.payload?.text ?? c.delta ?? '')
        .join('')
        .toLowerCase();

      expect(assembledText).toContain('quantum computing');

      result.cleanup();
    } finally {
      await memoryMastra.backgroundTaskManager?.shutdown();
    }
  }, 60_000);

  it('streamUntilIdle closes after the initial turn when no background tasks are dispatched', async () => {
    const mockMemory = new MockMemory();
    const threadId = 'durable-stream-until-idle-thread-2';
    const resourceId = 'durable-stream-until-idle-user-2';

    const memoryBaseAgent = new Agent({
      id: 'durable-stream-until-idle-agent-2',
      name: 'Durable Stream Until Idle Agent 2',
      instructions:
        'You are a helpful assistant. ' + 'When asked to greet someone, use the greet tool. ' + 'Respond concisely.',
      model: openai('gpt-4o-mini'),
      tools: { research: researchTool, greet: greetTool },
      memory: mockMemory,
      backgroundTasks: { tools: { research: true } },
    });

    const memoryDurableAgent = createDurableAgent({ agent: memoryBaseAgent });

    const memoryMastra = new Mastra({
      agents: { 'durable-stream-until-idle-agent-2': memoryDurableAgent as any },
      backgroundTasks: {
        enabled: true,
        globalConcurrency: 5,
        perAgentConcurrency: 3,
      },
      storage: testStorage,
    });

    try {
      const result = await memoryDurableAgent.streamUntilIdle('Greet someone named Carol', {
        memory: { thread: threadId, resource: resourceId },
      });

      const chunks: any[] = [];
      for await (const chunk of result.fullStream) {
        chunks.push(chunk);
      }

      const bgStarted = chunks.find(c => c.type === 'background-task-started');
      expect(bgStarted).toBeUndefined();

      const greetResult = chunks.find(c => c.type === 'tool-result' && c.payload?.toolName === 'greet');
      expect(greetResult).toBeDefined();

      const finishes = chunks.filter(c => c.type === 'finish');
      expect(finishes.length).toBe(1);

      const assembledText = chunks
        .filter(c => c?.type === 'text-delta')
        .map(c => c.payload?.text ?? c.delta ?? '')
        .join('')
        .toLowerCase();
      expect(assembledText).toContain('carol');

      result.cleanup();
    } finally {
      await memoryMastra.backgroundTaskManager?.shutdown();
    }
  }, 30_000);
});
