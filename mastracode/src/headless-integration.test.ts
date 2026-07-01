import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import type {
  GatewayAuthRequest,
  GatewayAuthResult,
  GatewayLanguageModel,
  MastraModelGatewayInterface,
  ProviderConfig,
} from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import { AgentsMDInjector } from '@mastra/core/processors';
import { createSignal } from '@mastra/core/signals';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { Workspace } from '@mastra/core/workspace';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import z from 'zod';

import { runHeadless } from './headless.js';
import { isSignalMessage, getReminderView, getStateSignalView } from './tui/db-message-parts.js';

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

// Prevent default gateways (models.dev, netlify) from hitting the network
// during model-catalog tests. Errors are caught by GatewayManager.listProviders.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network disabled in tests')));
});

async function waitFor(condition: () => boolean, timeoutMs = 5_000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

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

function createControllerWithAgent(opts: {
  doStream: () => Promise<{ stream: ReadableStream }>;
  tools?: Record<string, any>;
  inputProcessors?: any[];
  outputProcessors?: any[];
}) {
  const tempDir = mkdtempSync(join(tmpdir(), 'mastracode-headless-'));
  const storePath = join(tempDir, 'test.db');
  tempStorePaths.push(storePath, tempDir);

  const storage = new LibSQLStore({
    id: 'test-store',
    url: `file:${storePath}`,
  });

  const agent = new Agent({
    id: 'test-agent',
    name: 'Test Agent',
    instructions: 'You are a test agent.',
    model: new MastraLanguageModelV2Mock({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        ...(await opts.doStream()),
      }),
    }) as any,
    tools: opts.tools ?? {},
    inputProcessors: opts.inputProcessors,
    outputProcessors: opts.outputProcessors,
  });
  const mastra = new Mastra({ agents: { 'test-agent': agent }, logger: false, storage });
  const registeredAgent = mastra.getAgent('test-agent');

  const controller = new AgentController({
    id: 'test-controller',
    storage,
    workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
    modes: [
      {
        id: 'default',
        name: 'Default',
        description: 'default',
        defaultModelId: 'test',
        instructions: 'you are a test agent',
        metadata: { default: true },
      },
    ],
    initialState: { yolo: true } as any,
  });
  (controller as any).getAgentForMode = () => registeredAgent;

  return controller;
}

describe('headless mode — event-driven auto-resolution', () => {
  it('emits agent_start and agent_end for a simple text response', async () => {
    const controller = createControllerWithAgent({
      doStream: async () => ({ stream: createTextStream('Hello from the agent!') }),
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.sendMessage({ content: 'Say hello' });

    const types = events.map(e => e.type);
    expect(types).toContain('agent_start');
    expect(types).toContain('agent_end');
    // agent_end should have reason 'complete'
    const agentEnd = events.find(e => e.type === 'agent_end') as Extract<AgentControllerEvent, { type: 'agent_end' }>;
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
    const controller = createControllerWithAgent({
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

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.sendMessage({ content: 'Read test.txt' });

    const types = events.map(e => e.type);
    expect(types).toContain('tool_start');
    expect(types).toContain('tool_end');
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('resumes same-run-id suspended tools through the subscribed thread stream exactly once', async () => {
    const confirmTool = createTool({
      id: 'confirmAction',
      description: 'Confirm an action',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const resumeData = context?.agent?.resumeData ?? context?.workflow?.resumeData ?? context?.resumeData;
        if (resumeData) {
          return { result: `${input.action} confirmed`, resumeData };
        }

        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `${input.action} pending` };
      },
    });

    let callCount = 0;
    const controller = createControllerWithAgent({
      doStream: async () => {
        callCount++;
        return {
          stream:
            callCount === 1
              ? createToolCallStream('confirmAction', '{"action":"deploy"}')
              : createTextStream('Deployment confirmed.'),
        };
      },
      tools: { confirmAction: confirmTool },
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.sendMessage({ content: 'Deploy to production' });

    expect(events.some(e => e.type === 'tool_suspended')).toBe(true);
    const suspendedEndCount = events.filter(e => e.type === 'agent_end' && (e as any).reason === 'suspended').length;
    expect(suspendedEndCount).toBe(1);

    const resumeStartIndex = events.length;
    // Generic tool resume reuses the suspended runId and resumes from tool-result
    // chunks, not a fresh start chunk. The subscribed thread stream must own that
    // output; otherwise this waits forever or produces duplicate resume events.
    await session.respondToToolSuspension({ resumeData: { confirmed: true } });
    await waitFor(() =>
      events.slice(resumeStartIndex).some(e => e.type === 'agent_end' && (e as any).reason === 'complete'),
    );

    const resumeEvents = events.slice(resumeStartIndex);
    expect(callCount).toBe(2);
    expect(resumeEvents.filter(e => e.type === 'agent_start')).toHaveLength(1);
    expect(resumeEvents.filter(e => e.type === 'agent_end' && (e as any).reason === 'complete')).toHaveLength(1);
    expect(
      resumeEvents.some(e =>
        e.type === 'message_update'
          ? (e as any).message?.content?.parts?.some(
              (part: any) => part.type === 'text' && part.text?.includes('Deployment confirmed'),
            )
          : false,
      ),
    ).toBe(true);
    expect(resumeEvents.some(e => e.type === 'error')).toBe(false);
  });

  it('streams message_update events with text content', async () => {
    const controller = createControllerWithAgent({
      doStream: async () => ({ stream: createTextStream('Here is the result.') }),
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.sendMessage({ content: 'Do something' });

    const messageUpdates = events.filter(e => e.type === 'message_update');
    expect(messageUpdates.length).toBeGreaterThan(0);

    // At least one update should contain text
    const hasText = messageUpdates.some(e => {
      const msg = (e as any).message;
      return msg?.content?.parts?.some((c: any) => c.type === 'text' && c.text?.includes('result'));
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

    const controller = createControllerWithAgent({
      doStream: async () => ({ stream: neverEndingStream }),
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    // Fire-and-forget (same pattern as headless mode)
    const sendPromise = session.sendMessage({ content: 'Do something slow' });

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

    session.abort();

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
    const controller = createControllerWithAgent({
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

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.sendMessage({ content: 'Check the nested instructions' });

    expect(mockExecute).toHaveBeenCalledTimes(1);

    const matchesReminder = (message: Extract<AgentControllerEvent, { type: 'message_end' }>['message']) => {
      if (!isSignalMessage(message)) return false;
      const reminder = getReminderView(message);
      return (
        reminder.reminderType === 'dynamic-agents-md' &&
        reminder.path === instructionPath &&
        reminder.message === instructionContents
      );
    };

    // The dynamic-agents-md reminder is now delivered as its own DB-native
    // `role: 'signal'` message (message_start/message_end), not flattened into
    // an assistant message's content.
    const reminderSignalMessages = events.filter(
      (event): event is Extract<AgentControllerEvent, { type: 'message_start' | 'message_end' }> =>
        (event.type === 'message_start' || event.type === 'message_end') && matchesReminder(event.message),
    );

    expect(reminderSignalMessages.length).toBeGreaterThan(0);

    const finalReminderSignal = [...events]
      .reverse()
      .find(
        (event): event is Extract<AgentControllerEvent, { type: 'message_end' }> =>
          event.type === 'message_end' && matchesReminder(event.message),
      );

    expect(finalReminderSignal).toBeDefined();
  });
});

function createFakeGatewayFromModels(
  customModels: { id: string; provider: string; modelName: string; hasApiKey: boolean; apiKeyEnvVar?: string }[],
): MastraModelGatewayInterface {
  // Group models by provider for fetchProviders
  const providers: Record<string, ProviderConfig> = {};
  for (const m of customModels) {
    if (!providers[m.provider]) {
      providers[m.provider] = {
        name: m.provider,
        models: [],
        apiKeyEnvVar: m.apiKeyEnvVar ?? `${m.provider.toUpperCase().replace(/-/g, '_')}_API_KEY`,
        gateway: 'models.dev',
      };
    }
    providers[m.provider]!.models!.push(m.modelName);
  }

  // Build a lookup from routerId → hasApiKey for resolveAuth
  const authMap = new Map(customModels.map(m => [m.id, m.hasApiKey]));

  return {
    id: 'models.dev',
    name: 'Test models.dev Gateway',
    fetchProviders: async () => providers,
    buildUrl: () => 'https://example.com/v1',
    getApiKey: async () => {
      throw new Error('no api key');
    },
    resolveAuth: (request: GatewayAuthRequest): GatewayAuthResult | undefined => {
      if (authMap.get(request.routerId)) {
        return { apiKey: 'test-key', source: 'gateway' };
      }
      return undefined;
    },
    resolveLanguageModel: () => ({}) as GatewayLanguageModel,
  };
}

function createControllerWithModels(opts: {
  doStream: () => Promise<{ stream: ReadableStream }>;
  customModels?: { id: string; provider: string; modelName: string; hasApiKey: boolean; apiKeyEnvVar?: string }[];
}) {
  const tempDir = mkdtempSync(join(tmpdir(), 'mastracode-headless-model-'));
  const storePath = join(tempDir, 'test.db');
  tempStorePaths.push(storePath, tempDir);

  const storage = new LibSQLStore({
    id: 'test-store',
    url: `file:${storePath}`,
  });

  const agent = new Agent({
    id: 'test-agent',
    name: 'Test Agent',
    instructions: 'You are a test agent.',
    model: new MastraLanguageModelV2Mock({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        ...(await opts.doStream()),
      }),
    }) as any,
  });
  const mastra = new Mastra({ agents: { 'test-agent': agent }, logger: false, storage });
  const registeredAgent = mastra.getAgent('test-agent');

  const controller = new AgentController({
    id: 'test-controller',
    storage,
    workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
    modes: [
      {
        id: 'default',
        name: 'Default',
        description: 'default',
        defaultModelId: 'test',
        metadata: { default: true },
        instructions: 'You are a test agent.',
      },
    ],
    initialState: { yolo: true } as any,
    gateways: [createFakeGatewayFromModels(opts.customModels ?? [])],
  });
  (controller as any).getAgentForMode = () => registeredAgent;

  return controller;
}

describe('headless mode — --output-format contracts', () => {
  it('prints only final assistant text to stdout for text output', async () => {
    const controller = createControllerWithAgent({
      doStream: async () => ({ stream: createTextStream('Plain text response') }),
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const {
      result: exitCode,
      stdout,
      stderr,
    } = await captureProcessOutput(() =>
      runHeadless(controller, session, {
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
    const controller = createControllerWithAgent({
      doStream: async () => ({ stream: createTextStream('JSON summary response') }),
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const {
      result: exitCode,
      stdout,
      stderr,
      stdoutChunks,
    } = await captureProcessOutput(() =>
      runHeadless(controller, session, {
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
    const controller = createControllerWithAgent({
      doStream: async () => ({ stream: createTextStream('Streamed JSON response') }),
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const {
      result: exitCode,
      stdout,
      stderr,
    } = await captureProcessOutput(() =>
      runHeadless(controller, session, {
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
    expect(assistantEnd?.message.content.parts).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'Streamed JSON response' })]),
    );
  });

  it('keeps state-signal messages visible in stream-json message events', async () => {
    let listener: ((event: AgentControllerEvent) => void) | undefined;
    const stateSignalMessage = createSignal({
      id: 'state-signal-browser-1',
      type: 'state',
      tagName: 'browser',
      contents: 'Browser state changed',
      metadata: { state: { id: 'browser', mode: 'delta', cacheKey: 'browser:v2', version: 2 } },
    } as never).toDBMessage();
    const controller = {
      session: {
        sendMessage: vi.fn(async () => {
          listener?.({ type: 'agent_start', runId: 'run-state' } as AgentControllerEvent);
          listener?.({
            type: 'message_end',
            message: stateSignalMessage,
          } as AgentControllerEvent);
          listener?.({
            type: 'message_end',
            message: {
              id: 'assistant-state-message',
              role: 'assistant',
              content: { format: 2, parts: [{ type: 'text', text: 'Observed browser state.' }] },
              createdAt: new Date(0),
            },
          } as AgentControllerEvent);
          listener?.({ type: 'agent_end', reason: 'complete' } as AgentControllerEvent);
        }),
        subscribe: vi.fn((next: (event: AgentControllerEvent) => void) => {
          listener = next;
          return () => {};
        }),
        thread: { getId: vi.fn(() => 'thread-state') },
      },
    } as unknown as AgentController<Record<string, unknown>>;

    const {
      result: exitCode,
      stdout,
      stderr,
    } = await captureProcessOutput(() =>
      runHeadless(
        controller as unknown as AgentController<Record<string, unknown>>,
        (controller as any).session as any,
        {
          prompt: 'Describe the browser state',
          format: 'default',
          outputFormat: 'stream-json',
          continue_: false,
          cloneThread: false,
        },
      ),
    );

    expect(exitCode).toBe(0);
    expect(stderr).toBe('');

    const events = stdout
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    const stateSignalEnd = events.find(event => event.type === 'message_end' && event.message?.role === 'signal');
    expect(stateSignalEnd).toBeDefined();
    expect(getStateSignalView(stateSignalEnd.message)).toMatchObject({
      stateId: 'browser',
      mode: 'delta',
      cacheKey: 'browser:v2',
      version: 2,
      message: 'Browser state changed',
    });

    const assistantEnd = events.find(event => event.type === 'message_end' && event.message?.role === 'assistant');
    expect(assistantEnd?.message.content.parts).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'Observed browser state.' })]),
    );
    expect(events.find(event => event.type === 'agent_end')).toMatchObject({ reason: 'complete' });
  });
});

describe('headless mode — --model flag', () => {
  it('switches model when a valid --model is provided', async () => {
    const controller = createControllerWithModels({
      doStream: async () => ({ stream: createTextStream('Response text') }),
      customModels: [
        { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
      ],
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    const exitCode = await runHeadless(controller, session, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      model: 'anthropic/claude-haiku-4-5',
    });

    expect(exitCode).toBe(0);

    const modelChanged = events.find(e => e.type === 'model_changed') as any;
    expect(modelChanged).toBeDefined();
    expect(modelChanged.modelId).toBe('anthropic/claude-haiku-4-5');

    // Verify the controller state was updated
    expect(session.model.get()).toBe('anthropic/claude-haiku-4-5');
  });

  it('returns exit code 1 for an unknown model', async () => {
    const controller = createControllerWithModels({
      doStream: async () => ({ stream: createTextStream('Should not reach here') }),
      customModels: [
        { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
      ],
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const stderrCalls: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((...args: any[]) => {
      stderrCalls.push(String(args[0]));
      return origWrite(...(args as Parameters<typeof origWrite>));
    });

    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    const exitCode = await runHeadless(controller, session, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      model: 'nonexistent/model-xyz',
    });

    stderrSpy.mockRestore();

    expect(exitCode).toBe(1);
    expect(events.find(e => e.type === 'agent_start')).toBeUndefined();
    expect(stderrCalls.join('')).toContain('Unknown model');
    expect(stderrCalls.join('')).toContain('nonexistent/model-xyz');
  });

  it('returns exit code 1 when model has no API key', async () => {
    const controller = createControllerWithModels({
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

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const stderrCalls: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((...args: any[]) => {
      stderrCalls.push(String(args[0]));
      return origWrite(...(args as Parameters<typeof origWrite>));
    });

    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    const exitCode = await runHeadless(controller, session, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      model: 'openai/gpt-4o',
    });

    stderrSpy.mockRestore();

    expect(exitCode).toBe(1);
    expect(events.find(e => e.type === 'agent_start')).toBeUndefined();
    expect(stderrCalls.join('')).toContain('no API key configured');
    expect(stderrCalls.join('')).toContain('OPENAI_API_KEY');
  });

  it('emits JSON error for unknown model in json format', async () => {
    const controller = createControllerWithModels({
      doStream: async () => ({ stream: createTextStream('Should not reach here') }),
      customModels: [],
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    const exitCode = await runHeadless(controller, session, {
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
    const controller = createControllerWithModels({
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

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    const exitCode = await runHeadless(controller, session, {
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
    const controller = createControllerWithModels({
      doStream: async () => ({ stream: createTextStream('Response text') }),
      customModels: [
        { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
      ],
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const stderrCalls: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((...args: any[]) => {
      stderrCalls.push(String(args[0]));
      return origWrite(...(args as Parameters<typeof origWrite>));
    });

    const exitCode = await runHeadless(controller, session, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      model: 'anthropic/claude-haiku-4-5',
      mode: 'fast',
    });

    stderrSpy.mockRestore();

    expect(exitCode).toBe(0);
    expect(stderrCalls.join('')).toContain('--model overrides --mode');
    expect(session.model.get()).toBe('anthropic/claude-haiku-4-5');
  });

  it('emits structured warning in JSON mode when --model and --mode are both provided', async () => {
    const controller = createControllerWithModels({
      doStream: async () => ({ stream: createTextStream('Response text') }),
      customModels: [
        { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
      ],
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    const exitCode = await runHeadless(controller, session, {
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
    const controller = createControllerWithModels({
      doStream: async () => ({ stream: createTextStream('Response text') }),
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    const exitCode = await runHeadless(controller, session, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
    });

    expect(exitCode).toBe(0);

    // No model_changed event should have been emitted
    expect(events.find(e => e.type === 'model_changed')).toBeUndefined();
  });
});

describe('headless mode — --mode with effectiveDefaults', () => {
  it('--mode fast switches to effectiveDefaults.fast', async () => {
    const controller = createControllerWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [{ id: 'cerebras/zai-glm-4.7', provider: 'cerebras', modelName: 'zai-glm-4.7', hasApiKey: true }],
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    const exitCode = await runHeadless(
      controller,
      session,
      {
        prompt: 'Hello',
        format: 'default',
        continue_: false,
        mode: 'fast',
      },
      { build: 'anthropic/claude-opus-4-6', fast: 'cerebras/zai-glm-4.7', plan: 'openai/gpt-5.2-codex' },
    );

    expect(exitCode).toBe(0);
    expect(session.model.get()).toBe('cerebras/zai-glm-4.7');
  });

  it('--model still overrides effectiveDefaults', async () => {
    const controller = createControllerWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [
        { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
        { id: 'cerebras/zai-glm-4.7', provider: 'cerebras', modelName: 'zai-glm-4.7', hasApiKey: true },
      ],
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const exitCode = await runHeadless(
      controller,
      session,
      {
        prompt: 'Hello',
        format: 'default',
        continue_: false,
        model: 'anthropic/claude-haiku-4-5',
        mode: 'fast',
      },
      { build: 'anthropic/claude-opus-4-6', fast: 'cerebras/zai-glm-4.7', plan: 'openai/gpt-5.2-codex' },
    );

    expect(exitCode).toBe(0);
    // --model should win over effectiveDefaults
    expect(session.model.get()).toBe('anthropic/claude-haiku-4-5');
  });

  it('--mode returns exit code 1 when resolved model is not available', async () => {
    const controller = createControllerWithModels({
      doStream: async () => ({ stream: createTextStream('Should not reach here') }),
      customModels: [], // No models available
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const stderrCalls: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((...args: any[]) => {
      stderrCalls.push(String(args[0]));
      return origWrite(...(args as Parameters<typeof origWrite>));
    });

    const exitCode = await runHeadless(
      controller,
      session,
      {
        prompt: 'Hello',
        format: 'default',
        continue_: false,
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
    const controller = createControllerWithModels({
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

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const stderrCalls: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((...args: any[]) => {
      stderrCalls.push(String(args[0]));
      return origWrite(...(args as Parameters<typeof origWrite>));
    });

    const exitCode = await runHeadless(
      controller,
      session,
      {
        prompt: 'Hello',
        format: 'default',
        continue_: false,
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
    const controller = createControllerWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [],
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const stderrCalls: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((...args: any[]) => {
      stderrCalls.push(String(args[0]));
      return origWrite(...(args as Parameters<typeof origWrite>));
    });

    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    // No effectiveDefaults passed — should warn, not error
    const exitCode = await runHeadless(controller, session, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
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
    const controller = createControllerWithAgent({
      doStream: async () => ({ stream: createTextStream('Resumed!') }),
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const thread = await session.thread.create({ title: 'target-thread' });
    const updatedAtBefore = thread.updatedAt.getTime();

    await new Promise(resolve => setTimeout(resolve, 300));

    const exitCode = await runHeadless(controller, session, {
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
    const threads = await session.thread.list();
    const targeted = threads.find(t => t.id === thread.id);
    expect(targeted).toBeDefined();
    expect(targeted!.updatedAt.getTime()).toBeGreaterThan(updatedAtBefore);
  });

  it('resumes a thread by title with --thread', async () => {
    const controller = createControllerWithAgent({
      doStream: async () => ({ stream: createTextStream('Found by title!') }),
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const thread = await session.thread.create({ title: 'my-feature' });
    const updatedAtBefore = thread.updatedAt.getTime();

    await new Promise(resolve => setTimeout(resolve, 300));

    const exitCode = await runHeadless(controller, session, {
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
    const threads = await session.thread.list();
    const targeted = threads.find(t => t.id === thread.id);
    expect(targeted).toBeDefined();
    expect(targeted!.updatedAt.getTime()).toBeGreaterThan(updatedAtBefore);
  });

  it('returns exit code 1 for unknown thread', async () => {
    const controller = createControllerWithAgent({
      doStream: async () => ({ stream: createTextStream('Should not reach') }),
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const exitCode = await runHeadless(controller, session, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      cloneThread: false,
      thread: 'nonexistent-thread',
    });

    expect(exitCode).toBe(1);
  });

  it('renames thread with --title', async () => {
    const controller = createControllerWithAgent({
      doStream: async () => ({ stream: createTextStream('Titled!') }),
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    await session.thread.create({ title: 'original-title' });

    const exitCode = await runHeadless(controller, session, {
      prompt: 'Hello',
      format: 'default',
      continue_: true,
      cloneThread: false,
      title: 'my-new-title',
    });

    expect(exitCode).toBe(0);

    const threads = await session.thread.list();
    const titled = threads.find(t => t.title === 'my-new-title');
    expect(titled).toBeDefined();
  });

  it('scopes --thread and --continue to the requested resource ID', async () => {
    const controller = createControllerWithAgent({
      doStream: async () => ({ stream: createTextStream('Scoped resource response') }),
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    controller.setResourceId(session, { resourceId: 'resource-a' });
    const alphaOlderThread = await session.thread.create({ title: 'older-alpha' });
    controller.setResourceId(session, { resourceId: 'resource-b' });
    const betaThread = await session.thread.create({ title: 'shared-title' });
    await new Promise(resolve => setTimeout(resolve, 5));
    controller.setResourceId(session, { resourceId: 'resource-a' });
    const alphaThread = await session.thread.create({ title: 'shared-title' });

    let exitCode = await runHeadless(controller, session, {
      prompt: 'Hello beta',
      format: 'default',
      continue_: false,
      cloneThread: false,
      resourceId: 'resource-b',
      thread: 'shared-title',
    });

    expect(exitCode).toBe(0);
    expect(session.identity.getResourceId()).toBe('resource-b');
    expect(session.thread.getId()).toBe(betaThread.id);

    exitCode = await runHeadless(controller, session, {
      prompt: 'Hello alpha',
      format: 'default',
      continue_: true,
      cloneThread: false,
      resourceId: 'resource-a',
    });

    expect(exitCode).toBe(0);
    expect(session.identity.getResourceId()).toBe('resource-a');
    expect(session.thread.getId()).toBe(alphaThread.id);
    expect(session.thread.getId()).not.toBe(alphaOlderThread.id);
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

    const mastra = new Mastra({ agents: { 'test-agent': agent }, logger: false, storage });
    const registeredAgent = mastra.getAgent('test-agent');

    const controller = new AgentController({
      id: 'test-controller',
      storage,
      memory,
      workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
      gateways: [
        createFakeGatewayFromModels([
          {
            id: 'anthropic/claude-haiku-4-5',
            provider: 'anthropic',
            modelName: 'claude-haiku-4-5',
            hasApiKey: true,
          },
        ]),
      ],
      modes: [
        {
          id: 'default',
          name: 'Default',
          description: 'default',
          metadata: { default: true },
          instructions: 'You are a test agent.',
          defaultModelId: 'test',
        },
      ],
      initialState: { yolo: true } as any,
    });
    (controller as any).getAgentForMode = () => registeredAgent;

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const sourceThread = await session.thread.create({ title: 'source-thread' });

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
      const exitCode = await runHeadless(controller, session, {
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
