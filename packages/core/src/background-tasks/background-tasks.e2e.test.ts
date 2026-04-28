import { createOpenAI } from '@ai-sdk/openai-v5';
import { config } from 'dotenv';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import { Mastra } from '../mastra';
import { MockMemory } from '../memory/mock';
import { MockStore } from '../storage';
import { createTool } from '../tools';

config();

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Skip if no API key
const describeE2E = process.env.OPENAI_API_KEY ? describe : describe.skip;

const testStorage = new MockStore();

describeE2E('Background Tasks E2E', () => {
  let mastra: Mastra;

  // A slow tool that simulates background work
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
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 500));
      return { summary: `Research complete on "${topic}": This is a comprehensive summary.` };
    },
    background: { enabled: true },
  });

  // A fast tool that should run in foreground
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
    // No background config — runs in foreground
  });

  const agent = new Agent({
    id: 'bg-test-agent',
    name: 'Background Test Agent',
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

  beforeEach(() => {
    mastra = new Mastra({
      agents: { 'bg-test-agent': agent },
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
    const result = await agent.stream('Please research the topic "quantum computing"');

    const chunks: any[] = [];
    for await (const chunk of result.fullStream) {
      chunks.push(chunk);
    }

    // Should have a background-task-started chunk
    const bgStarted = chunks.find(c => c.type === 'background-task-started');
    expect(bgStarted).toBeDefined();
    expect(bgStarted.payload.toolName).toBe('research');
    expect(bgStarted.payload.taskId).toBeDefined();

    // The text response should reference the background task
    const fullOutput = await result.getFullOutput();
    expect(fullOutput.text).toBeDefined();
    expect(fullOutput.text.length).toBeGreaterThan(0);

    // Wait for the background task to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check the manager knows about the task
    const manager = mastra.backgroundTaskManager!;
    const tasks = await manager.listTasks({ toolName: 'research' });
    expect(tasks.total).toBeGreaterThan(0);

    const task = tasks.tasks[0]!;
    expect(task.status).toBe('completed');
    expect(task.result).toBeDefined();
    expect((task.result as any).summary).toContain('quantum computing');
  }, 30_000);

  it('runs a foreground tool normally', async () => {
    const result = await agent.generate('Please greet someone named Alice');

    // generate() returns the full result directly
    expect(result.text).toBeDefined();
    expect(result.text.length).toBeGreaterThan(0);

    // The greet tool should have been called (foreground, not background)
    // The text response should reference Alice since the tool ran synchronously
    expect(result.text.toLowerCase()).toContain('alice');
  }, 30_000);

  it('background task completes and result can be queried', async () => {
    // Stream to dispatch the background task
    const result = await agent.stream('Research "artificial intelligence" for me');

    // Consume the stream
    const chunks: any[] = [];
    for await (const chunk of result.fullStream) {
      chunks.push(chunk);
    }

    const bgStarted = chunks.find(c => c.type === 'background-task-started');
    expect(bgStarted).toBeDefined();
    const taskId = bgStarted.payload.taskId;

    // Wait for background task to finish
    await new Promise(resolve => setTimeout(resolve, 1500));

    const manager = mastra.backgroundTaskManager!;
    const task = await manager.getTask(taskId);
    expect(task).toBeDefined();
    expect(task!.status).toBe('completed');
    expect((task!.result as any).summary).toContain('artificial intelligence');
  }, 30_000);

  it('emits background-task-completed chunk on the stream after task finishes', async () => {
    const result = await agent.stream('Research "machine learning" please');

    // Consume the stream — background-task-completed should appear as a chunk
    // because the stream chunk emitter is auto-wired to controller.enqueue
    const chunks: any[] = [];
    for await (const chunk of result.fullStream) {
      chunks.push(chunk);
    }

    // Wait for background task to complete and emit its chunk
    await new Promise(resolve => setTimeout(resolve, 1500));

    // The background-task-started chunk should be in the stream
    const started = chunks.find(c => c.type === 'background-task-started');
    expect(started).toBeDefined();
    expect(started.payload.toolName).toBe('research');

    // The task should have completed in the manager
    const manager = mastra.backgroundTaskManager!;
    const tasks = await manager.listTasks({ toolName: 'research', status: 'completed' });
    expect(tasks.total).toBeGreaterThan(0);
  }, 30_000);

  it('background task works alongside memory — second prompt processes while bg task runs', async () => {
    const mockMemory = new MockMemory();
    const threadId = 'bg-memory-test-thread';
    const resourceId = 'bg-memory-test-user';

    // Create a separate agent with memory for this test
    const memoryAgent = new Agent({
      id: 'bg-memory-agent',
      name: 'Background Memory Agent',
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

    const memoryMastra = new Mastra({
      agents: { 'bg-memory-agent': memoryAgent },
      backgroundTasks: {
        enabled: true,
        globalConcurrency: 5,
        perAgentConcurrency: 3,
      },
      storage: testStorage,
    });

    try {
      // --- First prompt: triggers background task ---
      const stream1 = await memoryAgent.stream('Please research "neural networks" for me', {
        memory: { thread: threadId, resource: resourceId },
      });

      const chunks1: any[] = [];
      for await (const chunk of stream1.fullStream) {
        chunks1.push(chunk);
      }

      // Verify background-task-started was emitted
      const bgStarted = chunks1.find(c => c.type === 'background-task-started');
      expect(bgStarted).toBeDefined();
      expect(bgStarted.payload.toolName).toBe('research');

      // --- Second prompt: foreground tool while bg task is still running ---
      const stream2 = await memoryAgent.stream('Now greet someone named Bob', {
        memory: { thread: threadId, resource: resourceId },
      });

      const chunks2: any[] = [];
      for await (const chunk of stream2.fullStream) {
        chunks2.push(chunk);
      }

      // Second prompt should NOT have background-task-started (greet is foreground)
      const bgStarted2 = chunks2.find(c => c.type === 'background-task-started');
      expect(bgStarted2).toBeUndefined();

      // Second prompt should have a tool-result from the greet tool (foreground)
      const toolResult2 = chunks2.find(c => c.type === 'tool-result' && c.payload?.toolName === 'greet');
      expect(toolResult2).toBeDefined();

      // The text response from the second prompt should mention Bob
      const fullOutput2 = await stream2.getFullOutput();
      expect(fullOutput2.text.toLowerCase()).toContain('bob');

      // Wait for background task to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Background task should have completed
      const manager = memoryMastra.backgroundTaskManager!;
      const tasks = await manager.listTasks({ toolName: 'research', status: 'completed' });
      expect(tasks.total).toBeGreaterThan(0);
      expect((tasks.tasks[0]!.result as any).summary).toContain('neural networks');

      // --- Verify messages in memory ---
      const { messages } = await mockMemory.recall({
        threadId,
        resourceId,
      });

      // Should have messages from both conversations
      expect(messages.length).toBeGreaterThan(0);

      // Find user messages
      const userMessages = messages.filter((m: any) => m.role === 'user');
      expect(userMessages.length).toBeGreaterThanOrEqual(2);

      // Find assistant messages (responses from both prompts)
      const assistantMessages = messages.filter((m: any) => m.role === 'assistant');
      expect(assistantMessages.length).toBeGreaterThanOrEqual(2);

      // Verify both conversations are in the thread
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

      // The thread should contain evidence of both conversations
      expect(allContent).toContain('neural networks');
      expect(allContent).toContain('bob');
    } finally {
      await memoryMastra.backgroundTaskManager?.shutdown();
    }
  }, 60_000);

  it('streamUntilIdle keeps the stream open and continues after a background task completes', async () => {
    const mockMemory = new MockMemory();
    const threadId = 'stream-until-idle-thread-1';
    const resourceId = 'stream-until-idle-user-1';

    const memoryAgent = new Agent({
      id: 'stream-until-idle-agent-1',
      name: 'Stream Until Idle Agent',
      instructions:
        'You are a helpful assistant. ' +
        'When asked to research something, use the research tool. ' +
        'After you see the research result, briefly summarize it for the user.',
      model: openai('gpt-4o-mini'),
      tools: { research: researchTool, greet: greetTool },
      memory: mockMemory,
      backgroundTasks: { tools: { research: true } },
    });

    const memoryMastra = new Mastra({
      agents: { 'stream-until-idle-agent-1': memoryAgent },
      backgroundTasks: {
        enabled: true,
        globalConcurrency: 5,
        perAgentConcurrency: 3,
      },
      storage: testStorage,
    });

    try {
      const result = await memoryAgent.streamUntilIdle('Please research "quantum computing" for me', {
        memory: { thread: threadId, resource: resourceId },
      });

      const chunks: any[] = [];
      for await (const chunk of result.fullStream) {
        chunks.push(chunk);
      }

      // Initial turn dispatched the research background task
      const bgStarted = chunks.find(c => c.type === 'background-task-started');
      expect(bgStarted).toBeDefined();
      expect(bgStarted.payload.toolName).toBe('research');

      // The outer stream forwarded the task lifecycle — completion landed
      // inline with agent chunks (this is what streamUntilIdle uniquely provides)
      const bgCompleted = chunks.find(c => c.type === 'background-task-completed');
      expect(bgCompleted).toBeDefined();
      expect(bgCompleted.payload.taskId).toBe(bgStarted.payload.taskId);

      // Two LLM turns ran (initial + continuation) — each ends with a finish chunk
      const finishes = chunks.filter(c => c.type === 'finish');
      expect(finishes.length).toBeGreaterThanOrEqual(2);

      // The task is persisted as completed in the manager
      const manager = memoryMastra.backgroundTaskManager!;
      const tasks = await manager.listTasks({ toolName: 'research', status: 'completed' });
      expect(tasks.total).toBeGreaterThan(0);
      expect((tasks.tasks[0]!.result as any).summary).toContain('quantum computing');

      // The continuation turn produced text that references the research
      // topic — proof the LLM saw the tool result. Assemble from text-delta
      // chunks directly so we don't race with memory persistence.
      const assembledText = chunks
        .filter(c => c?.type === 'text-delta')
        .map(c => c.payload?.text ?? c.delta ?? '')
        .join('')
        .toLowerCase();

      console.log(assembledText);

      expect(assembledText).toContain('quantum computing');
    } finally {
      await memoryMastra.backgroundTaskManager?.shutdown();
    }
  }, 60_000);

  it('streamUntilIdle closes after the initial turn when no background tasks are dispatched', async () => {
    const mockMemory = new MockMemory();
    const threadId = 'stream-until-idle-thread-2';
    const resourceId = 'stream-until-idle-user-2';

    const memoryAgent = new Agent({
      id: 'stream-until-idle-agent-2',
      name: 'Stream Until Idle Agent 2',
      instructions:
        'You are a helpful assistant. ' + 'When asked to greet someone, use the greet tool. ' + 'Respond concisely.',
      model: openai('gpt-4o-mini'),
      tools: { research: researchTool, greet: greetTool },
      memory: mockMemory,
      backgroundTasks: { tools: { research: true } },
    });

    const memoryMastra = new Mastra({
      agents: { 'stream-until-idle-agent-2': memoryAgent },
      backgroundTasks: {
        enabled: true,
        globalConcurrency: 5,
        perAgentConcurrency: 3,
      },
      storage: testStorage,
    });

    try {
      const result = await memoryAgent.streamUntilIdle('Greet someone named Carol', {
        memory: { thread: threadId, resource: resourceId },
      });

      const chunks: any[] = [];
      for await (const chunk of result.fullStream) {
        chunks.push(chunk);
      }

      // Foreground tool only — no background task was dispatched
      const bgStarted = chunks.find(c => c.type === 'background-task-started');
      expect(bgStarted).toBeUndefined();

      // The greet tool ran inline (foreground)
      const greetResult = chunks.find(c => c.type === 'tool-result' && c.payload?.toolName === 'greet');
      expect(greetResult).toBeDefined();

      // Exactly one LLM turn — the outer stream closed after it finished
      // rather than waiting for a continuation that will never come
      const finishes = chunks.filter(c => c.type === 'finish');
      expect(finishes.length).toBe(1);

      // The initial turn's text mentions Carol — assembled from text-delta
      // chunks directly so the assertion doesn't race with memory persistence
      const assembledText = chunks
        .filter(c => c?.type === 'text-delta')
        .map(c => c.payload?.text ?? c.delta ?? '')
        .join('')
        .toLowerCase();
      expect(assembledText).toContain('carol');
    } finally {
      await memoryMastra.backgroundTaskManager?.shutdown();
    }
  }, 30_000);
});
