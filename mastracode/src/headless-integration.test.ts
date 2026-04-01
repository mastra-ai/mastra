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
import { describe, it, expect, vi, afterEach } from 'vitest';
import z from 'zod';

import { runHeadless, type PackContext } from './headless.js';

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
    harness.subscribe(event => events.push(event));

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
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

    const events: HarnessEvent[] = [];
    harness.subscribe(event => events.push(event));

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      model: 'nonexistent/model-xyz',
    });

    expect(exitCode).toBe(1);

    // Agent should never have started
    expect(events.find(e => e.type === 'agent_start')).toBeUndefined();
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

    const events: HarnessEvent[] = [];
    harness.subscribe(event => events.push(event));

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      model: 'openai/gpt-4o',
    });

    expect(exitCode).toBe(1);

    // Agent should never have started
    expect(events.find(e => e.type === 'agent_start')).toBeUndefined();
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
    harness.subscribe(event => events.push(event));

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
    });

    expect(exitCode).toBe(0);

    // No model_changed event should have been emitted
    expect(events.find(e => e.type === 'model_changed')).toBeUndefined();
  });
});

describe('headless mode — config file', () => {
  it('loads config file via --config and switches model', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [
        { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'claude-sonnet-4-5', hasApiKey: true },
      ],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'));
    tempStorePaths.push(configDir);
    const configPath = join(configDir, 'headless.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        models: { modeDefaults: { build: 'anthropic/claude-sonnet-4-5' } },
      }),
    );

    const events: HarnessEvent[] = [];
    harness.subscribe(event => events.push(event));

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      config: configPath,
    });

    expect(exitCode).toBe(0);
    const modelChanged = events.find(e => e.type === 'model_changed') as any;
    expect(modelChanged).toBeDefined();
    expect(modelChanged.modelId).toBe('anthropic/claude-sonnet-4-5');
  });

  it('applies all modeDefaults and wires subagent models', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [
        { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'claude-sonnet-4-5', hasApiKey: true },
        { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
      ],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'));
    tempStorePaths.push(configDir);
    const configPath = join(configDir, 'headless.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        models: {
          modeDefaults: {
            build: 'anthropic/claude-sonnet-4-5',
            fast: 'anthropic/claude-haiku-4-5',
          },
        },
      }),
    );

    const events: HarnessEvent[] = [];
    harness.subscribe(event => events.push(event));

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      config: configPath,
    });

    expect(exitCode).toBe(0);
    // Current mode (build) model should be switched
    expect(harness.getCurrentModelId()).toBe('anthropic/claude-sonnet-4-5');
    // Subagent models should be wired (explore→fast, execute→build)
    expect(harness.getSubagentModelId({ agentType: 'explore' })).toBe('anthropic/claude-haiku-4-5');
    expect(harness.getSubagentModelId({ agentType: 'execute' })).toBe('anthropic/claude-sonnet-4-5');
  });

  it('--model flag overrides config file model', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [
        { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
        { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'claude-sonnet-4-5', hasApiKey: true },
      ],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'));
    tempStorePaths.push(configDir);
    const configPath = join(configDir, 'headless.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        models: { modeDefaults: { build: 'anthropic/claude-sonnet-4-5' } },
      }),
    );

    const events: HarnessEvent[] = [];
    harness.subscribe(event => events.push(event));

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      model: 'anthropic/claude-haiku-4-5',
      config: configPath,
    });

    expect(exitCode).toBe(0);
    expect(harness.getCurrentModelId()).toBe('anthropic/claude-haiku-4-5');
  });

  it('--mode selects model from config modeDefaults', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [{ id: 'cerebras/zai-glm-4.7', provider: 'cerebras', modelName: 'zai-glm-4.7', hasApiKey: true }],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'));
    tempStorePaths.push(configDir);
    const configPath = join(configDir, 'headless.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        models: { modeDefaults: { fast: 'cerebras/zai-glm-4.7' } },
      }),
    );

    const events: HarnessEvent[] = [];
    harness.subscribe(event => events.push(event));

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      mode: 'fast',
      config: configPath,
    });

    expect(exitCode).toBe(0);
    expect(harness.getCurrentModelId()).toBe('cerebras/zai-glm-4.7');
  });

  it('returns exit code 1 for missing --config path', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      config: '/nonexistent/headless.json',
    });

    expect(exitCode).toBe(1);
  });

  it('--profile selects named profile model', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [
        { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
        { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'claude-sonnet-4-5', hasApiKey: true },
      ],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'));
    tempStorePaths.push(configDir);
    const configPath = join(configDir, 'headless.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        models: { modeDefaults: { build: 'anthropic/claude-sonnet-4-5' } },
        profiles: {
          ci: {
            models: { modeDefaults: { build: 'anthropic/claude-haiku-4-5' } },
          },
        },
      }),
    );

    const events: HarnessEvent[] = [];
    harness.subscribe(event => events.push(event));

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      config: configPath,
      profile: 'ci',
    });

    expect(exitCode).toBe(0);
    expect(harness.getCurrentModelId()).toBe('anthropic/claude-haiku-4-5');
  });

  it('--profile + --thinking-level flag overrides profile thinking level', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'));
    tempStorePaths.push(configDir);
    const configPath = join(configDir, 'headless.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        profiles: {
          ci: {
            preferences: { thinkingLevel: 'off' },
          },
        },
      }),
    );

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
      config: configPath,
      profile: 'ci',
      thinkingLevel: 'high',
    });

    stderrSpy.mockRestore();

    expect(exitCode).toBe(0);
    // --thinking-level flag should win over profile's thinkingLevel
    const stderrOutput = stderrCalls.join('');
    expect(stderrOutput).toContain('[thinking] high');
  });

  it('unknown --profile returns exit code 1', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'));
    tempStorePaths.push(configDir);
    const configPath = join(configDir, 'headless.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        profiles: {
          ci: { preferences: { yolo: true } },
        },
      }),
    );

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      config: configPath,
      profile: 'staging',
    });

    expect(exitCode).toBe(1);
  });

  it('--profile fails gracefully when config has no profiles section', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'));
    tempStorePaths.push(configDir);
    const configPath = join(configDir, 'headless.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        models: { modeDefaults: { build: 'anthropic/claude-sonnet-4-5' } },
      }),
    );

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      config: configPath,
      profile: 'ci',
    });

    expect(exitCode).toBe(1);
  });

  it('returns exit code 1 when config references unknown model', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'));
    tempStorePaths.push(configDir);
    const configPath = join(configDir, 'headless.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        models: { modeDefaults: { build: 'nonexistent/model' } },
      }),
    );

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      config: configPath,
    });

    expect(exitCode).toBe(1);
  });
});

describe('headless mode — pack resolution', () => {
  const testPackContext: PackContext = {
    builtinPacks: [
      {
        id: 'test-pack',
        models: {
          build: 'anthropic/claude-sonnet-4-5',
          fast: 'anthropic/claude-haiku-4-5',
          plan: 'anthropic/claude-sonnet-4-5',
        },
      },
    ],
    builtinOmPacks: [{ id: 'test-om-pack', modelId: 'anthropic/claude-haiku-4-5' }],
  };

  it('activeModelPackId resolves correct models via packContext', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [
        { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'claude-sonnet-4-5', hasApiKey: true },
        { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
      ],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'));
    tempStorePaths.push(configDir);
    const configPath = join(configDir, 'headless.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        models: { activeModelPackId: 'test-pack' },
      }),
    );

    const exitCode = await runHeadless(
      harness,
      {
        prompt: 'Hello',
        format: 'default',
        continue_: false,
        config: configPath,
      },
      testPackContext,
    );

    expect(exitCode).toBe(0);
    expect(harness.getCurrentModelId()).toBe('anthropic/claude-sonnet-4-5');
    expect(harness.getSubagentModelId({ agentType: 'explore' })).toBe('anthropic/claude-haiku-4-5');
  });

  it('modeDefaults overrides activeModelPackId when both present', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [
        { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
      ],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'));
    tempStorePaths.push(configDir);
    const configPath = join(configDir, 'headless.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        models: {
          activeModelPackId: 'test-pack',
          modeDefaults: { build: 'anthropic/claude-haiku-4-5' },
        },
      }),
    );

    const exitCode = await runHeadless(
      harness,
      {
        prompt: 'Hello',
        format: 'default',
        continue_: false,
        config: configPath,
      },
      testPackContext,
    );

    expect(exitCode).toBe(0);
    // modeDefaults should win over activeModelPackId
    expect(harness.getCurrentModelId()).toBe('anthropic/claude-haiku-4-5');
  });

  it('subagentModels overrides pack-derived subagent wiring', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [
        { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'claude-sonnet-4-5', hasApiKey: true },
        { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
        { id: 'openai/gpt-4o', provider: 'openai', modelName: 'gpt-4o', hasApiKey: true },
      ],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'));
    tempStorePaths.push(configDir);
    const configPath = join(configDir, 'headless.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        models: {
          activeModelPackId: 'test-pack',
          subagentModels: { explore: 'openai/gpt-4o' },
        },
      }),
    );

    const exitCode = await runHeadless(
      harness,
      {
        prompt: 'Hello',
        format: 'default',
        continue_: false,
        config: configPath,
      },
      testPackContext,
    );

    expect(exitCode).toBe(0);
    // subagentModels should override the pack-derived explore model
    expect(harness.getSubagentModelId({ agentType: 'explore' })).toBe('openai/gpt-4o');
  });

  it('activeOmPackId resolves to correct OM model', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [
        { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
      ],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'));
    tempStorePaths.push(configDir);
    const configPath = join(configDir, 'headless.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        models: { activeOmPackId: 'test-om-pack' },
      }),
    );

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
        config: configPath,
      },
      testPackContext,
    );

    stderrSpy.mockRestore();

    expect(exitCode).toBe(0);
    expect(stderrCalls.join('')).toContain('[om-model] anthropic/claude-haiku-4-5');
  });

  it('omModelOverride applies to observer and reflector', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [{ id: 'openai/gpt-4o', provider: 'openai', modelName: 'gpt-4o', hasApiKey: true }],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'));
    tempStorePaths.push(configDir);
    const configPath = join(configDir, 'headless.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        models: { omModelOverride: 'openai/gpt-4o' },
      }),
    );

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
        config: configPath,
      },
      testPackContext,
    );

    stderrSpy.mockRestore();

    expect(exitCode).toBe(0);
    expect(stderrCalls.join('')).toContain('[om-model] openai/gpt-4o');
  });

  it('OM thresholds are applied to harness state', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'));
    tempStorePaths.push(configDir);
    const configPath = join(configDir, 'headless.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        models: {
          omObservationThreshold: 0.7,
          omReflectionThreshold: 0.3,
        },
      }),
    );

    const exitCode = await runHeadless(
      harness,
      {
        prompt: 'Hello',
        format: 'default',
        continue_: false,
        config: configPath,
      },
      testPackContext,
    );

    expect(exitCode).toBe(0);
    const state = harness.getState() as any;
    expect(state.observationThreshold).toBe(0.7);
    expect(state.reflectionThreshold).toBe(0.3);
  });

  it('unknown activeModelPackId falls through gracefully', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'));
    tempStorePaths.push(configDir);
    const configPath = join(configDir, 'headless.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        models: { activeModelPackId: 'nonexistent-pack' },
      }),
    );

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
        config: configPath,
      },
      testPackContext,
    );

    stderrSpy.mockRestore();

    expect(exitCode).toBe(0);
    expect(stderrCalls.join('')).toContain('Unknown model pack "nonexistent-pack"');
  });

  it('custom: pack ID warns and is ignored', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'));
    tempStorePaths.push(configDir);
    const configPath = join(configDir, 'headless.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        models: { activeModelPackId: 'custom:my-pack' },
      }),
    );

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
        config: configPath,
      },
      testPackContext,
    );

    stderrSpy.mockRestore();

    expect(exitCode).toBe(0);
    expect(stderrCalls.join('')).toContain('Custom pack references are not supported');
  });

  it('--model flag still overrides pack-based resolution', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [
        { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'claude-sonnet-4-5', hasApiKey: true },
        { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
      ],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'));
    tempStorePaths.push(configDir);
    const configPath = join(configDir, 'headless.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        models: { activeModelPackId: 'test-pack' },
      }),
    );

    const exitCode = await runHeadless(
      harness,
      {
        prompt: 'Hello',
        format: 'default',
        continue_: false,
        model: 'anthropic/claude-haiku-4-5',
        config: configPath,
      },
      testPackContext,
    );

    expect(exitCode).toBe(0);
    // --model should win over pack
    expect(harness.getCurrentModelId()).toBe('anthropic/claude-haiku-4-5');
  });

  it('pack resolution without packContext degrades gracefully', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'));
    tempStorePaths.push(configDir);
    const configPath = join(configDir, 'headless.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        models: { activeModelPackId: 'test-pack' },
      }),
    );

    // No packContext passed — should not error, just skip pack resolution
    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      config: configPath,
    });

    expect(exitCode).toBe(0);
  });
});
