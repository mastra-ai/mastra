import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Agent } from '@mastra/core/agent';
import { Harness } from '@mastra/core/harness';
import type { HarnessEvent } from '@mastra/core/harness';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { afterAll, describe, it, expect, vi } from 'vitest';
import z from 'zod';

import { runHeadless } from './headless.js';

vi.setConfig({ testTimeout: 30_000 });

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
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

function createHarnessWithAgent(opts: {
  doStream: () => Promise<{ stream: ReadableStream }>;
  tools?: Record<string, any>;
}) {
  const agent = new Agent({
    id: 'test-agent',
    name: 'Test Agent',
    instructions: 'You are a test agent.',
    model: new MastraLanguageModelV2Mock({ doStream: opts.doStream }),
    tools: opts.tools ?? {},
  });

  const storage = new LibSQLStore({
    id: 'test-store',
    url: 'file::memory:?cache=shared',
  });

  const harness = new Harness({
    id: 'test-harness',
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
    initialState: { yolo: true },
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
    harness.subscribe(event => events.push(event));

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
    harness.subscribe(event => events.push(event));

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
    harness.subscribe(event => events.push(event));

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
    harness.subscribe(event => events.push(event));

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
});

const tempStorePaths: string[] = [];
afterAll(() => {
  for (const p of tempStorePaths) {
    try {
      rmSync(p, { recursive: true, force: true });
    } catch {}
  }
});

describe('headless mode — --model flag', () => {
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

    const tempDir = mkdtempSync(join(tmpdir(), 'mastracode-headless-config-'));
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
    writeFileSync(configPath, JSON.stringify({
      models: { modeDefaults: { build: 'anthropic/claude-sonnet-4-5' } },
    }));

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
    writeFileSync(configPath, JSON.stringify({
      models: { modeDefaults: { build: 'anthropic/claude-sonnet-4-5' } },
    }));

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
      customModels: [
        { id: 'cerebras/zai-glm-4.7', provider: 'cerebras', modelName: 'zai-glm-4.7', hasApiKey: true },
      ],
    });

    await harness.init();
    await harness.selectOrCreateThread();

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'));
    tempStorePaths.push(configDir);
    const configPath = join(configDir, 'headless.json');
    writeFileSync(configPath, JSON.stringify({
      models: { modeDefaults: { fast: 'cerebras/zai-glm-4.7' } },
    }));

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
    writeFileSync(configPath, JSON.stringify({
      models: { modeDefaults: { build: 'nonexistent/model' } },
    }));

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      config: configPath,
    });

    expect(exitCode).toBe(1);
  });
});
