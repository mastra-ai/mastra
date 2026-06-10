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

import { HarnessCompat } from './HarnessCompat.js';
import { runHeadless } from './headless.js';

vi.setConfig({ testTimeout: 30_000 });

const REMINDER_TEXT =
  'When using guidance from a discovered instruction file, mention the instruction file you used and how it affected your response.';
const isHarnessV1Compat = process.env.MASTRACODE_TEST_HARNESS_BACKEND === 'v1-compat';

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

async function captureProcessOutput<T>(fn: () => Promise<T>) {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
    stdoutChunks.push(String(chunk));
    return true;
  }) as typeof process.stdout.write);
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => {
    stderrChunks.push(String(chunk));
    return true;
  }) as typeof process.stderr.write);

  try {
    const result = await fn();
    return {
      result,
      stdout: stdoutChunks.join(''),
      stderr: stderrChunks.join(''),
      stdoutChunks,
      stderrChunks,
    };
  } finally {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  }
}

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

  it.skipIf(isHarnessV1Compat)('can abort a running agent and receive agent_end with aborted reason', async () => {
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

  it.skipIf(isHarnessV1Compat)('AgentsMDInjector persists a system reminder after instruction-file tool usage', async () => {
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

function createHarnessWithModels(opts: {
  doStream: () => Promise<{ stream: ReadableStream }>;
  customModels?: { id: string; provider: string; modelName: string; hasApiKey: boolean; apiKeyEnvVar?: string }[];
}) {
  const agent = new Agent({
    id: 'test-agent',
    name: 'Test Agent',
    instructions: 'You are a test agent.',
    model: new MastraLanguageModelV2Mock({ doStream: opts.doStream }) as any,
    tools: {},
  });

  const tempDir = mkdtempSync(join(tmpdir(), 'mastracode-headless-model-'));
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
    customModelCatalogProvider: () =>
      (opts.customModels ?? []).map(m => ({
        ...m,
        useCount: 0,
      })),
  });

  return harness;
}

describe('headless mode — --output-format contracts', () => {
  it('prints only final assistant text to stdout for text output', async () => {
    const harness = createHarnessWithAgent({
      doStream: async () => ({ stream: createTextStream('Plain text response') }),
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const {
      result: exitCode,
      stdout,
      stderr,
    } = await captureProcessOutput(() =>
      runHeadless(harness, {
        prompt: 'Hello',
        format: 'default',
        outputFormat: 'text',
        continue_: false,
        cloneThread: false,
      }),
    );

    expect(exitCode).toBe(0);
    expect(stdout).toBe('Plain text response\n');
    expect(stderr).toBe('');
  });

  it('prints one final summary object to stdout for json output', async () => {
    const harness = createHarnessWithAgent({
      doStream: async () => ({ stream: createTextStream('JSON summary response') }),
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const {
      result: exitCode,
      stdout,
      stderr,
      stdoutChunks,
    } = await captureProcessOutput(() =>
      runHeadless(harness, {
        prompt: 'Hello',
        format: 'default',
        outputFormat: 'json',
        continue_: false,
        cloneThread: false,
      }),
    );

    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdoutChunks).toHaveLength(1);

    const summary = JSON.parse(stdout.trim());
    expect(summary).toMatchObject({
      text: 'JSON summary response',
      finishReason: 'complete',
      toolCalls: [],
      toolResults: [],
    });
    expect(summary.threadId).toEqual(expect.any(String));
    expect(summary.type).toBeUndefined();
  });

  it('prints newline-delimited runtime events to stdout for stream-json output', async () => {
    const harness = createHarnessWithAgent({
      doStream: async () => ({ stream: createTextStream('Streamed JSON response') }),
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const {
      result: exitCode,
      stdout,
      stderr,
    } = await captureProcessOutput(() =>
      runHeadless(harness, {
        prompt: 'Hello',
        format: 'default',
        outputFormat: 'stream-json',
        continue_: false,
        cloneThread: false,
      }),
    );

    expect(exitCode).toBe(0);
    expect(stderr).toBe('');

    const events = stdout
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    expect(events.map(event => event.type)).toEqual(
      expect.arrayContaining(['agent_start', 'message_end', 'agent_end']),
    );
    expect(events.find(event => event.type === 'agent_end')).toMatchObject({ reason: 'complete' });
    expect(events.some(event => event.text === 'Streamed JSON response')).toBe(false);

    const assistantEnd = events.find(event => event.type === 'message_end' && event.message?.role === 'assistant');
    expect(assistantEnd?.message.content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'Streamed JSON response' })]),
    );
  });

  it('keeps state-signal parts visible in stream-json message events', async () => {
    let listener: ((event: HarnessEvent) => void) | undefined;
    const stateSignalPart = {
      type: 'state_signal',
      id: 'state-signal-browser-1',
      stateId: 'browser',
      mode: 'delta',
      cacheKey: 'browser:v2',
      version: 2,
      message: 'Browser state changed',
    };
    const harness = {
      subscribe: vi.fn((next: (event: HarnessEvent) => void) => {
        listener = next;
        return () => {};
      }),
      sendMessage: vi.fn(async () => {
        listener?.({ type: 'agent_start', runId: 'run-state' } as HarnessEvent);
        listener?.({
          type: 'message_end',
          message: {
            id: 'assistant-state-message',
            role: 'assistant',
            content: [stateSignalPart, { type: 'text', text: 'Observed browser state.' }],
            createdAt: new Date(0),
          },
        } as HarnessEvent);
        listener?.({ type: 'agent_end', reason: 'complete' } as HarnessEvent);
      }),
      getCurrentThreadId: vi.fn(() => 'thread-state'),
    } as unknown as Harness<Record<string, unknown>>;

    const {
      result: exitCode,
      stdout,
      stderr,
    } = await captureProcessOutput(() =>
      runHeadless(harness, {
        prompt: 'Describe the browser state',
        format: 'default',
        outputFormat: 'stream-json',
        continue_: false,
        cloneThread: false,
      }),
    );

    expect(exitCode).toBe(0);
    expect(stderr).toBe('');

    const events = stdout
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    const assistantEnd = events.find(event => event.type === 'message_end' && event.message?.role === 'assistant');
    expect(assistantEnd?.message.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'state_signal',
          stateId: 'browser',
          mode: 'delta',
          cacheKey: 'browser:v2',
          message: 'Browser state changed',
        }),
      ]),
    );
    expect(assistantEnd?.message.content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'Observed browser state.' })]),
    );
    expect(events.find(event => event.type === 'agent_end')).toMatchObject({ reason: 'complete' });
  });
});

describe('headless mode — --model flag', () => {
  it('switches model when a valid --model is provided', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response text') }),
      customModels: [
        { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
      ],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      cloneThread: false,
      model: 'anthropic/claude-haiku-4-5',
    });

    expect(exitCode).toBe(0);

    const modelChanged = events.find(e => e.type === 'model_changed') as any;
    expect(modelChanged).toBeDefined();
    expect(modelChanged.modelId).toBe('anthropic/claude-haiku-4-5');

    // Verify the harness state was updated
    expect(harness.getCurrentModelId()).toBe('anthropic/claude-haiku-4-5');
  });

  it('returns exit code 1 for an unknown model', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Should not reach here') }),
      customModels: [
        { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
      ],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const stderrCalls: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((...args: any[]) => {
      stderrCalls.push(String(args[0]));
      return origWrite(...(args as Parameters<typeof origWrite>));
    });

    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      cloneThread: false,
      model: 'nonexistent/model-xyz',
    });

    stderrSpy.mockRestore();

    expect(exitCode).toBe(1);
    expect(events.find(e => e.type === 'agent_start')).toBeUndefined();
    expect(stderrCalls.join('')).toContain('Unknown model');
    expect(stderrCalls.join('')).toContain('nonexistent/model-xyz');
  });

  it('returns exit code 1 when model has no API key', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Should not reach here') }),
      customModels: [
        {
          id: 'openai/gpt-4o',
          provider: 'openai',
          modelName: 'gpt-4o',
          hasApiKey: false,
          apiKeyEnvVar: 'OPENAI_API_KEY',
        },
      ],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const stderrCalls: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((...args: any[]) => {
      stderrCalls.push(String(args[0]));
      return origWrite(...(args as Parameters<typeof origWrite>));
    });

    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      cloneThread: false,
      model: 'openai/gpt-4o',
    });

    stderrSpy.mockRestore();

    expect(exitCode).toBe(1);
    expect(events.find(e => e.type === 'agent_start')).toBeUndefined();
    expect(stderrCalls.join('')).toContain('no API key configured');
    expect(stderrCalls.join('')).toContain('OPENAI_API_KEY');
  });

  it('emits JSON error for unknown model in json format', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Should not reach here') }),
      customModels: [],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'json',
      continue_: false,
      cloneThread: false,
      model: 'nonexistent/model',
    });

    expect(exitCode).toBe(1);

    const stdoutLines = writeSpy.mock.calls.map(c => String(c[0]));
    writeSpy.mockRestore();

    const errorLine = stdoutLines.find(l => l.includes('"type":"error"'));
    expect(errorLine).toBeDefined();
    const parsed = JSON.parse(errorLine!.trim());
    expect(parsed.type).toBe('error');
    expect(parsed.error.message).toContain('Unknown model');
    expect(parsed.error.message).toContain('nonexistent/model');
  });

  it('emits JSON error for model without API key in json format', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Should not reach here') }),
      customModels: [
        {
          id: 'openai/gpt-4o',
          provider: 'openai',
          modelName: 'gpt-4o',
          hasApiKey: false,
          apiKeyEnvVar: 'OPENAI_API_KEY',
        },
      ],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'json',
      continue_: false,
      cloneThread: false,
      model: 'openai/gpt-4o',
    });

    expect(exitCode).toBe(1);

    const stdoutLines = writeSpy.mock.calls.map(c => String(c[0]));
    writeSpy.mockRestore();

    const errorLine = stdoutLines.find(l => l.includes('"type":"error"'));
    expect(errorLine).toBeDefined();
    const parsed = JSON.parse(errorLine!.trim());
    expect(parsed.type).toBe('error');
    expect(parsed.error.message).toContain('no API key configured');
    expect(parsed.error.message).toContain('OPENAI_API_KEY');
  });

  it('emits warning when --model and --mode are both provided', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response text') }),
      customModels: [
        { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
      ],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const stderrCalls: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((...args: any[]) => {
      stderrCalls.push(String(args[0]));
      return origWrite(...(args as Parameters<typeof origWrite>));
    });

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      cloneThread: false,
      model: 'anthropic/claude-haiku-4-5',
      mode: 'fast',
    });

    stderrSpy.mockRestore();

    expect(exitCode).toBe(0);
    expect(stderrCalls.join('')).toContain('--model overrides --mode');
    expect(harness.getCurrentModelId()).toBe('anthropic/claude-haiku-4-5');
  });

  it('emits structured warning in JSON mode when --model and --mode are both provided', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response text') }),
      customModels: [
        { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
      ],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'json',
      continue_: false,
      cloneThread: false,
      model: 'anthropic/claude-haiku-4-5',
      mode: 'fast',
    });

    const stdoutLines = writeSpy.mock.calls.map(c => String(c[0]));
    writeSpy.mockRestore();

    expect(exitCode).toBe(0);
    const warningLine = stdoutLines.find(l => l.includes('"type":"warning"'));
    expect(warningLine).toBeDefined();
    const parsed = JSON.parse(warningLine!.trim());
    expect(parsed.message).toContain('--model overrides --mode');
  });

  it('does not switch model when --model is not provided', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response text') }),
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      cloneThread: false,
    });

    expect(exitCode).toBe(0);

    // No model_changed event should have been emitted
    expect(events.find(e => e.type === 'model_changed')).toBeUndefined();
  });
});

describe('headless mode — --mode with effectiveDefaults', () => {
  it('--mode fast switches to effectiveDefaults.fast', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [{ id: 'cerebras/zai-glm-4.7', provider: 'cerebras', modelName: 'zai-glm-4.7', hasApiKey: true }],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    const exitCode = await runHeadless(
      harness,
      {
        prompt: 'Hello',
        format: 'default',
        continue_: false,
        cloneThread: false,
        mode: 'fast',
      },
      { build: 'anthropic/claude-opus-4-6', fast: 'cerebras/zai-glm-4.7', plan: 'openai/gpt-5.2-codex' },
    );

    expect(exitCode).toBe(0);
    expect(harness.getCurrentModelId()).toBe('cerebras/zai-glm-4.7');
  });

  it('--model still overrides effectiveDefaults', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [
        { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
        { id: 'cerebras/zai-glm-4.7', provider: 'cerebras', modelName: 'zai-glm-4.7', hasApiKey: true },
      ],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const exitCode = await runHeadless(
      harness,
      {
        prompt: 'Hello',
        format: 'default',
        continue_: false,
        cloneThread: false,
        model: 'anthropic/claude-haiku-4-5',
        mode: 'fast',
      },
      { build: 'anthropic/claude-opus-4-6', fast: 'cerebras/zai-glm-4.7', plan: 'openai/gpt-5.2-codex' },
    );

    expect(exitCode).toBe(0);
    // --model should win over effectiveDefaults
    expect(harness.getCurrentModelId()).toBe('anthropic/claude-haiku-4-5');
  });

  it('--mode returns exit code 1 when resolved model is not available', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Should not reach here') }),
      customModels: [], // No models available
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const stderrCalls: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((...args: any[]) => {
      stderrCalls.push(String(args[0]));
      return origWrite(...(args as Parameters<typeof origWrite>));
    });

    const exitCode = await runHeadless(
      harness,
      {
        prompt: 'Hello',
        format: 'default',
        continue_: false,
        cloneThread: false,
        mode: 'fast',
      },
      { build: 'anthropic/claude-opus-4-6', fast: 'nonexistent/model', plan: 'openai/gpt-5.2-codex' },
    );

    stderrSpy.mockRestore();

    expect(exitCode).toBe(1);
    expect(stderrCalls.join('')).toContain('Unknown model');
    expect(stderrCalls.join('')).toContain('nonexistent/model');
    expect(stderrCalls.join('')).toContain('mode');
  });

  it('--mode returns exit code 1 when resolved model has no API key', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Should not reach here') }),
      customModels: [
        {
          id: 'openai/gpt-4o',
          provider: 'openai',
          modelName: 'gpt-4o',
          hasApiKey: false,
          apiKeyEnvVar: 'OPENAI_API_KEY',
        },
      ],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const stderrCalls: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((...args: any[]) => {
      stderrCalls.push(String(args[0]));
      return origWrite(...(args as Parameters<typeof origWrite>));
    });

    const exitCode = await runHeadless(
      harness,
      {
        prompt: 'Hello',
        format: 'default',
        continue_: false,
        cloneThread: false,
        mode: 'fast',
      },
      { fast: 'openai/gpt-4o' },
    );

    stderrSpy.mockRestore();

    expect(exitCode).toBe(1);
    expect(stderrCalls.join('')).toContain('no API key configured');
    expect(stderrCalls.join('')).toContain('OPENAI_API_KEY');
  });

  it('no effectiveDefaults warns and falls back to default', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const stderrCalls: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((...args: any[]) => {
      stderrCalls.push(String(args[0]));
      return origWrite(...(args as Parameters<typeof origWrite>));
    });

    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    // No effectiveDefaults passed — should warn, not error
    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      cloneThread: false,
      mode: 'fast',
    });

    stderrSpy.mockRestore();

    expect(exitCode).toBe(0);
    expect(stderrCalls.join('')).toContain('--mode fast has no configured model, using default');
    // No model_changed event should have been emitted
    expect(events.find(e => e.type === 'model_changed')).toBeUndefined();
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

    await new Promise(resolve => setTimeout(resolve, 300));

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      cloneThread: false,
      thread: thread.id,
    });

    expect(exitCode).toBe(0);

    // Allow fire-and-forget persistTokenUsage to flush
    await new Promise(resolve => setTimeout(resolve, 300));

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

    await new Promise(resolve => setTimeout(resolve, 300));

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      cloneThread: false,
      thread: 'my-feature',
    });

    expect(exitCode).toBe(0);

    // Allow fire-and-forget persistTokenUsage to flush
    await new Promise(resolve => setTimeout(resolve, 300));

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

  it('scopes --thread and --continue to the requested resource ID', async () => {
    const harness = createHarnessWithAgent({
      doStream: async () => ({ stream: createTextStream('Scoped resource response') }),
    });

    await harness.init();
    harness.setResourceId({ resourceId: 'resource-a' });
    const alphaOlderThread = await harness.createThread({ title: 'older-alpha' });
    harness.setResourceId({ resourceId: 'resource-b' });
    const betaThread = await harness.createThread({ title: 'shared-title' });
    await new Promise(resolve => setTimeout(resolve, 5));
    harness.setResourceId({ resourceId: 'resource-a' });
    const alphaThread = await harness.createThread({ title: 'shared-title' });

    let exitCode = await runHeadless(harness, {
      prompt: 'Hello beta',
      format: 'default',
      continue_: false,
      cloneThread: false,
      resourceId: 'resource-b',
      thread: 'shared-title',
    });

    expect(exitCode).toBe(0);
    expect(harness.getResourceId()).toBe('resource-b');
    expect(harness.getCurrentThreadId()).toBe(betaThread.id);

    exitCode = await runHeadless(harness, {
      prompt: 'Hello alpha',
      format: 'default',
      continue_: true,
      cloneThread: false,
      resourceId: 'resource-a',
    });

    expect(exitCode).toBe(0);
    expect(harness.getResourceId()).toBe('resource-a');
    expect(harness.getCurrentThreadId()).toBe(alphaThread.id);
    expect(harness.getCurrentThreadId()).not.toBe(alphaOlderThread.id);
  });

  it('resumes a Harness v1 prefilled thread by title in headless mode', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are a test agent.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createTextStream('V1 title resumed!') }),
      }) as any,
      tools: {},
    });
    const tempDir = mkdtempSync(join(tmpdir(), 'mastracode-headless-v1-title-'));
    const storePath = join(tempDir, 'test.db');
    tempStorePaths.push(storePath, tempDir);
    const storage = new LibSQLStore({ id: 'test-store', url: `file:${storePath}` });
    const memory = new Memory({ storage });
    const session = {
      id: 'sess-prefilled-title',
      threadId: '',
      resourceId: '',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      lastActivityAt: new Date('2026-01-02T00:00:00.000Z'),
      modeId: 'default',
      modelId: 'openai/custom-thread-model',
      getMode: vi.fn(() => ({ id: 'default', description: 'Default' })),
      getModelId: vi.fn(() => 'openai/custom-thread-model'),
      setModelId: vi.fn(),
      getState: vi.fn(() => ({})),
      setState: vi.fn(async () => {}),
      subscribeToThread: vi.fn(async () => ({
        stream: (async function* () {
          yield { type: 'text-delta', id: 'text-1', delta: 'V1 title resumed!' };
          yield { type: 'finish' };
        })(),
      })),
      queueMessage: vi.fn(async () => ({ runId: 'run-prefilled-title' })),
    };
    const harnessV1 = {
      subscribe: vi.fn(() => () => {}),
      listSessions: vi.fn(async () => [session]),
      session: vi.fn(async () => session),
      getMode: vi.fn(() => ({ id: 'default', description: 'Default' })),
    };
    const harness = new HarnessCompat(
      {
        id: 'test-harness',
        resourceId: 'test-resource',
        storage,
        memory,
        modes: [{ id: 'default', name: 'Default', default: true, defaultModelId: 'mock-model', agent }],
        defaultAgent: agent,
        initialState: { yolo: true } as any,
      },
      harnessV1 as any,
    );

    await harness.init();
    const thread = await harness.createThread({ title: 'prefilled-title' });
    session.threadId = thread.id;
    session.resourceId = thread.resourceId!;

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      cloneThread: false,
      thread: 'prefilled-title',
    });

    expect(exitCode).toBe(0);
    expect(harness.getCurrentThreadId()).toBe(thread.id);
    expect(harnessV1.session).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: thread.id, resourceId: thread.resourceId }),
    );
    // The V1 prefilled session keeps its stored model when resumed by title.
    expect(session.setModelId).toHaveBeenCalledWith('openai/custom-thread-model');
    const threads = await harness.listThreads();
    const matchingThreads = threads.filter(t => t.id === thread.id);
    expect(matchingThreads).toHaveLength(1);
    const targeted = matchingThreads[0]!;
    expect(targeted.title).toBe('prefilled-title');
    expect(targeted.metadata).toMatchObject({
      sessionId: 'sess-prefilled-title',
      modeId: 'default',
      modelId: 'openai/custom-thread-model',
    });
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
