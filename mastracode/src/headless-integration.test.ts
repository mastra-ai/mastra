import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Agent } from '@mastra/core/agent';
import { Harness } from '@mastra/core/harness';
import type { HarnessEvent } from '@mastra/core/harness';
import { AgentsMDInjector } from '@mastra/core/processors';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, it, expect, vi, afterEach } from 'vitest';
import z from 'zod';

import { runHeadless } from './headless.js';

vi.setConfig({ testTimeout: 30_000 });

const REMINDER_TEXT =
  'When using guidance from a discovered instruction file, mention the instruction file you used and how it affected your response.';

/**
 * Creates a mock stream that produces a text response.
 */
function createTextStream(text: string) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'id-0',
        modelId: 'mock',
        timestamp: new Date(0),
      });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

/**
 * Creates a mock stream that calls a tool, then produces text.
 */
function createToolCallStream(toolName: string, args: string) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'id-0',
        modelId: 'mock',
        timestamp: new Date(0),
      });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName,
        input: args,
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'step-finish',
        id: 'step-1',
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        providerMetadata: undefined,
        warnings: [],
        isContinued: false,
        request: {},
        response: {
          id: 'resp-1',
          modelId: 'mock',
          timestamp: new Date(0),
        },
        logprobs: undefined,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

const tempStorePaths: string[] = [];

afterEach(() => {
  for (const storePath of tempStorePaths.splice(0)) {
    rmSync(storePath, { force: true, recursive: true });
  }
});

function createHarnessWithAgent(opts: {
  doStream: () => Promise<{ stream: ReadableStream }>;
  tools?: Record<string, any>;
  inputProcessors?: any[];
  outputProcessors?: any[];
}) {
  const agent = new Agent({
    id: 'test-agent',
    name: 'Test Agent',
    instructions: 'You are a test agent.',
    model: new MastraLanguageModelV2Mock({ doStream: opts.doStream }) as any,
    tools: opts.tools ?? {},
    inputProcessors: opts.inputProcessors ?? [],
    outputProcessors: opts.outputProcessors ?? [],
  });

  const tempDir = mkdtempSync(join(tmpdir(), 'mastracode-headless-'));
  const storePath = join(tempDir, 'test.db');
  tempStorePaths.push(storePath, tempDir);

  const storage = new LibSQLStore({
    id: 'test-store',
    url: `file:${storePath}`,
  });

  const harness = new Harness({
    id: 'test-harness',
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
    initialState: { yolo: true } as any,
  });

  return harness;
}

describe('headless mode — event-driven auto-resolution', () => {
  it('emits agent_start and agent_end for a simple text response', async () => {
    const harness = createHarnessWithAgent({
      doStream: async () => ({ stream: createTextStream('Hello from the agent!') }),
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.sendMessage({ content: 'Say hello' });

    const types = events.map(e => e.type);
    expect(types).toContain('agent_start');
    expect(types).toContain('agent_end');
    // agent_end should have reason 'complete'
    const agentEnd = events.find(e => e.type === 'agent_end') as Extract<HarnessEvent, { type: 'agent_end' }>;
    expect(agentEnd.reason).toBe('complete');
  });

  it('emits tool_start and tool_end when agent calls a tool', async () => {
    const mockExecute = vi.fn().mockResolvedValue({ content: 'file contents' });
    const readFileTool = createTool({
      id: 'readFile',
      description: 'Read a file',
      inputSchema: z.object({ path: z.string() }),
      execute: async input => mockExecute(input),
    });

    let callCount = 0;
    const harness = createHarnessWithAgent({
      doStream: async () => {
        callCount++;
        return {
          stream:
            callCount === 1
              ? createToolCallStream('readFile', '{"path":"test.txt"}')
              : createTextStream('File was read successfully.'),
        };
      },
      tools: { readFile: readFileTool },
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.sendMessage({ content: 'Read test.txt' });

    const types = events.map(e => e.type);
    expect(types).toContain('tool_start');
    expect(types).toContain('tool_end');
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('streams message_update events with text content', async () => {
    const harness = createHarnessWithAgent({
      doStream: async () => ({ stream: createTextStream('Here is the result.') }),
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.sendMessage({ content: 'Do something' });

    const messageUpdates = events.filter(e => e.type === 'message_update');
    expect(messageUpdates.length).toBeGreaterThan(0);

    // At least one update should contain text
    const hasText = messageUpdates.some(e => {
      const msg = (e as any).message;
      return msg?.content?.some((c: any) => c.type === 'text' && c.text?.includes('result'));
    });
    expect(hasText).toBe(true);
  });

  it('can abort a running agent and receive agent_end with aborted reason', async () => {
    // Create a stream that never finishes — simulates long-running agent
    const neverEndingStream = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'stream-start', warnings: [] });
        controller.enqueue({
          type: 'response-metadata',
          id: 'id-0',
          modelId: 'mock',
          timestamp: new Date(0),
        });
        controller.enqueue({ type: 'text-start', id: 'text-1' });
        controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'thinking...' });
        // Never close — simulates long-running response
      },
    });

    const harness = createHarnessWithAgent({
      doStream: async () => ({ stream: neverEndingStream }),
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    // Fire-and-forget (same pattern as headless mode)
    const sendPromise = harness.sendMessage({ content: 'Do something slow' });

    // Wait for agent_start, then abort
    await new Promise<void>(resolve => {
      const check = () => {
        if (events.some(e => e.type === 'agent_start')) {
          resolve();
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });

    harness.abort();

    // sendMessage should resolve (possibly with error)
    await sendPromise.catch(() => {});

    const agentEnd = events.find(e => e.type === 'agent_end') as any;
    expect(agentEnd).toBeDefined();
    expect(agentEnd.reason).toBe('aborted');
  });

  it('AgentsMDInjector persists a system reminder after instruction-file tool usage', async () => {
    const tempProjectDir = mkdtempSync(join(tmpdir(), 'mastracode-reminder-project-'));
    tempStorePaths.push(tempProjectDir);
    const instructionDir = join(tempProjectDir, 'src', 'agents', 'nested');
    const instructionPath = join(instructionDir, 'AGENTS.md');
    const instructionContents = '# nested instructions';

    mkdirSync(instructionDir, { recursive: true });
    writeFileSync(instructionPath, instructionContents, 'utf-8');

    const reminderProcessor = new AgentsMDInjector({
      reminderText: REMINDER_TEXT,
    });

    const mockExecute = vi.fn().mockResolvedValue({ content: instructionContents });
    const readFileTool = createTool({
      id: 'readFile',
      description: 'Read a file',
      inputSchema: z.object({ path: z.string() }),
      execute: async input => mockExecute(input),
    });

    let callCount = 0;
    const harness = createHarnessWithAgent({
      doStream: async () => {
        callCount++;
        return {
          stream:
            callCount === 1
              ? createToolCallStream('readFile', JSON.stringify({ path: instructionPath }))
              : createTextStream('I used the nested AGENTS.md instructions.'),
        };
      },
      tools: { readFile: readFileTool },
      inputProcessors: [reminderProcessor],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.sendMessage({ content: 'Check the nested instructions' });

    expect(mockExecute).toHaveBeenCalledTimes(1);

    const reminderUpdates = events.filter(
      (event): event is Extract<HarnessEvent, { type: 'message_update' }> => event.type === 'message_update',
    );
    const persistedReminderMessages = reminderUpdates.filter(event =>
      event.message.content.some(
        part =>
          part.type === 'system_reminder' &&
          part.reminderType === 'dynamic-agents-md' &&
          part.path === instructionPath &&
          part.message === instructionContents,
      ),
    );

    expect(persistedReminderMessages.length).toBeGreaterThan(0);

    const finalMessageEnd = [...events]
      .reverse()
      .find((event): event is Extract<HarnessEvent, { type: 'message_end' }> => event.type === 'message_end');

    expect(finalMessageEnd).toBeDefined();
    expect(
      finalMessageEnd?.message.content.some(
        part =>
          part.type === 'system_reminder' &&
          part.reminderType === 'dynamic-agents-md' &&
          part.path === instructionPath &&
          part.message === instructionContents,
      ),
    ).toBe(true);
  });
});

describe('headless mode — thread control', () => {
  it('resumes a thread by ID with --thread', async () => {
    const harness = createHarnessWithAgent({
      doStream: async () => ({ stream: createTextStream('Resumed!') }),
    });

    await harness.init();
    const thread = await harness.createThread({ title: 'target-thread' });
    const updatedAtBefore = thread.updatedAt.getTime();

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      cloneThread: false,
      thread: thread.id,
    });

    expect(exitCode).toBe(0);

    // Verify the targeted thread was actually used (updatedAt advanced)
    const threads = await harness.listThreads();
    const targeted = threads.find(t => t.id === thread.id);
    expect(targeted).toBeDefined();
    expect(targeted!.updatedAt.getTime()).toBeGreaterThan(updatedAtBefore);
  });

  it('resumes a thread by title with --thread', async () => {
    const harness = createHarnessWithAgent({
      doStream: async () => ({ stream: createTextStream('Found by title!') }),
    });

    await harness.init();
    const thread = await harness.createThread({ title: 'my-feature' });
    const updatedAtBefore = thread.updatedAt.getTime();

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      cloneThread: false,
      thread: 'my-feature',
    });

    expect(exitCode).toBe(0);

    // Verify the titled thread was actually used
    const threads = await harness.listThreads();
    const targeted = threads.find(t => t.id === thread.id);
    expect(targeted).toBeDefined();
    expect(targeted!.updatedAt.getTime()).toBeGreaterThan(updatedAtBefore);
  });

  it('returns exit code 1 for unknown thread', async () => {
    const harness = createHarnessWithAgent({
      doStream: async () => ({ stream: createTextStream('Should not reach') }),
    });

    await harness.init();

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      cloneThread: false,
      thread: 'nonexistent-thread',
    });

    expect(exitCode).toBe(1);
  });

  it('renames thread with --title', async () => {
    const harness = createHarnessWithAgent({
      doStream: async () => ({ stream: createTextStream('Titled!') }),
    });

    await harness.init();
    await harness.createThread({ title: 'original-title' });

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: true,
      cloneThread: false,
      title: 'my-new-title',
    });

    expect(exitCode).toBe(0);

    const threads = await harness.listThreads();
    const titled = threads.find(t => t.title === 'my-new-title');
    expect(titled).toBeDefined();
  });

  it('emits thread_cloned event with new thread ID when cloning a named thread', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are a test agent.',
      model: new MastraLanguageModelV2Mock({ doStream: async () => ({ stream: createTextStream('Cloned!') }) }) as any,
      tools: {},
    });

    const tempDir = mkdtempSync(join(tmpdir(), 'mastracode-headless-clone-'));
    const storePath = join(tempDir, 'test.db');
    tempStorePaths.push(storePath, tempDir);

    const storage = new LibSQLStore({
      id: 'test-store',
      url: `file:${storePath}`,
    });

    const memory = new Memory({ storage });

    const harness = new Harness({
      id: 'test-harness',
      storage,
      memory,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
      initialState: { yolo: true } as any,
    });

    await harness.init();
    const sourceThread = await harness.createThread({ title: 'source-thread' });

    const events: any[] = [];
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: any) => {
      try {
        events.push(JSON.parse(chunk.toString()));
      } catch {
        // Non-JSON output (debug logs, etc.) — ignore
      }
      return true;
    }) as any;

    try {
      const exitCode = await runHeadless(harness, {
        prompt: 'Hello',
        format: 'json',
        continue_: false,
        cloneThread: true,
        thread: 'source-thread',
      });

      expect(exitCode).toBe(0);

      const cloneEvent = events.find(e => e.type === 'thread_cloned');
      expect(cloneEvent).toBeDefined();
      expect(cloneEvent.threadId).toBeTypeOf('string');
      expect(cloneEvent.threadId.length).toBeGreaterThan(0);

      // Cloned thread should have a different ID than source
      expect(cloneEvent.threadId).not.toBe(sourceThread.id);
    } finally {
      process.stdout.write = originalWrite;
    }
  });
});
