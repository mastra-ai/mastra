import { Agent } from '@mastra/core/agent';
import { AgentController, SessionStartupCancelledError } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { Workspace } from '@mastra/core/workspace';
import { LibSQLStore } from '@mastra/libsql';
import { describe, it, expect, vi } from 'vitest';
import z from 'zod';

import { runMC } from './run-mc.js';
import type { ResolutionPolicy } from './types.js';

// These tests exercise prompt runs, which do not construct a goal manager.
vi.mock('../goal-manager.js', () => ({ GoalManager: vi.fn() }));

vi.setConfig({ testTimeout: 30_000 });

function textStream(text: string, finishReason: 'stop' | 'tool-calls' = 'stop') {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

function toolCallStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'readFile',
        input: '{"path":"test.txt"}',
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

interface HarnessOptions {
  doStream: () => Promise<{ stream: ReadableStream }>;
  withReadFileTool?: boolean;
  readFileNeedsApproval?: boolean;
}

async function makeHarness(opts: HarnessOptions) {
  const storage = new LibSQLStore({ id: 'test-store', url: 'file::memory:?cache=shared' });

  const tools: Record<string, ReturnType<typeof createTool>> = {};
  if (opts.withReadFileTool) {
    tools.readFile = createTool({
      id: 'readFile',
      description: 'Read a file',
      inputSchema: z.object({ path: z.string() }),
      ...(opts.readFileNeedsApproval ? { requireApproval: true } : {}),
      execute: async () => ({ content: 'file contents' }),
    });
  }

  const agent = new Agent({
    id: 'test-agent',
    name: 'Test Agent',
    instructions: 'You answer questions.',
    model: new MastraLanguageModelV2Mock({ doStream: opts.doStream }) as any,
    tools,
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
        instructions: 'You answer questions.',
      },
      {
        id: 'build',
        name: 'Build',
        description: 'build',
        defaultModelId: 'test',
        instructions: 'You answer questions.',
      },
    ],
    initialState: { yolo: false },
  });
  (controller as any).getAgentForMode = () => registeredAgent;

  await controller.init();
  const session = await controller.createSession({ id: `s-${Math.random()}`, ownerId: 'test-owner' });
  await session.thread.create();

  return { controller, session };
}

describe('runMC', () => {
  it('resolves the final result when awaited without iterating', async () => {
    const { controller, session } = await makeHarness({
      doStream: async () => ({ stream: textStream('The answer is 4.') }),
    });

    const run = runMC({ controller, session, prompt: 'What is 2+2?' });
    const result = await run.result;

    expect(result.status).toBe('completed');
    expect(result.exitCode).toBe(0);
    expect(result.text).toBe('The answer is 4.');
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
    expect(result.threadId).toBeTruthy();
  });

  it('creates a fresh thread when no thread option is provided', async () => {
    const { controller, session } = await makeHarness({
      doStream: async () => ({ stream: textStream('Fresh answer.') }),
    });
    const initialThreadId = session.thread.getId();

    const result = await runMC({ controller, session, prompt: 'Start fresh' }).result;

    expect(initialThreadId).toBeTruthy();
    expect(result.threadId).toBeTruthy();
    expect(result.threadId).not.toBe(initialThreadId);
  });

  it('applies the current mode default before sending a fresh prompt when mode is omitted', async () => {
    const { controller, session } = await makeHarness({
      doStream: async () => ({ stream: textStream('Pack-selected answer.') }),
    });
    const [packModel] = await controller.listAvailableModels();
    expect(packModel).toBeDefined();
    vi.spyOn(controller, 'listAvailableModels').mockResolvedValue([{ ...packModel!, hasApiKey: true }]);
    session.model.set({ modelId: 'openai/gpt-5.5' });
    const originalSendMessage = session.sendMessage.bind(session);
    let modelIdAtSend: string | undefined;
    vi.spyOn(session, 'sendMessage').mockImplementation(async input => {
      modelIdAtSend = session.model.get();
      return originalSendMessage(input);
    });

    const result = await runMC({
      controller,
      session,
      prompt: 'Use the selected pack',
      modeDefaults: { default: packModel!.id },
    }).result;

    expect(result.status).toBe('completed');
    expect(modelIdAtSend).toBe(packModel!.id);
  });

  it('preserves a restored thread model when mode is omitted', async () => {
    const { controller, session } = await makeHarness({
      doStream: async () => ({ stream: textStream('Restored answer.') }),
    });
    const restoredThreadId = session.thread.getId()!;
    await session.model.switch('anthropic/restored-model');
    await session.thread.create();

    const [packModel] = await controller.listAvailableModels();
    expect(packModel).toBeDefined();
    vi.spyOn(controller, 'listAvailableModels').mockResolvedValue([{ ...packModel!, hasApiKey: true }]);
    const originalSendMessage = session.sendMessage.bind(session);
    let modelIdAtSend: string | undefined;
    vi.spyOn(session, 'sendMessage').mockImplementation(async input => {
      modelIdAtSend = session.model.get();
      return originalSendMessage(input);
    });

    const result = await runMC({
      controller,
      session,
      prompt: 'Continue with the restored model',
      thread: { id: restoredThreadId },
      modeDefaults: { default: 'does-not-exist/default' },
    }).result;

    expect(result.status).toBe('completed');
    expect(modelIdAtSend).toBe('anthropic/restored-model');
  });

  it('applies an explicit model after restoring a thread', async () => {
    const { controller, session } = await makeHarness({
      doStream: async () => ({ stream: textStream('Explicit answer.') }),
    });
    const restoredThreadId = session.thread.getId()!;
    await session.model.switch('anthropic/restored-model');
    await session.thread.create();

    const [explicitModel] = await controller.listAvailableModels();
    expect(explicitModel).toBeDefined();
    vi.spyOn(controller, 'listAvailableModels').mockResolvedValue([{ ...explicitModel!, hasApiKey: true }]);
    const originalSendMessage = session.sendMessage.bind(session);
    let modelIdAtSend: string | undefined;
    vi.spyOn(session, 'sendMessage').mockImplementation(async input => {
      modelIdAtSend = session.model.get();
      return originalSendMessage(input);
    });

    const result = await runMC({
      controller,
      session,
      prompt: 'Override the restored model',
      thread: { id: restoredThreadId },
      model: explicitModel!.id,
    }).result;

    expect(result.status).toBe('completed');
    expect(modelIdAtSend).toBe(explicitModel!.id);
  });

  it('applies an explicit mode and its model after restoring a thread', async () => {
    const { controller, session } = await makeHarness({
      doStream: async () => ({ stream: textStream('Alternate answer.') }),
    });
    const restoredThreadId = session.thread.getId()!;
    await session.model.switch('anthropic/restored-model');
    await session.thread.create();

    const [alternateModel] = await controller.listAvailableModels();
    expect(alternateModel).toBeDefined();
    vi.spyOn(controller, 'listAvailableModels').mockResolvedValue([{ ...alternateModel!, hasApiKey: true }]);
    const originalSendMessage = session.sendMessage.bind(session);
    let modeIdAtSend: string | undefined;
    let modelIdAtSend: string | undefined;
    vi.spyOn(session, 'sendMessage').mockImplementation(async input => {
      modeIdAtSend = session.mode.get();
      modelIdAtSend = session.model.get();
      return originalSendMessage(input);
    });

    const result = await runMC({
      controller,
      session,
      prompt: 'Switch the restored thread mode',
      thread: { id: restoredThreadId },
      mode: 'build',
      modeDefaults: { build: alternateModel!.id },
    }).result;

    expect(result.status).toBe('completed');
    expect(modeIdAtSend).toBe('build');
    expect(modelIdAtSend).toBe(alternateModel!.id);
  });

  it('applies a pack to the session: mode model, thread metadata, subagent models, and route', async () => {
    const { controller, session } = await makeHarness({
      doStream: async () => ({ stream: textStream('Packed answer.') }),
    });
    const [packModel] = await controller.listAvailableModels();
    expect(packModel).toBeDefined();
    vi.spyOn(controller, 'listAvailableModels').mockResolvedValue([{ ...packModel!, hasApiKey: true }]);
    let modelIdAtSend: string | undefined;
    const originalSendMessage = session.sendMessage.bind(session);
    vi.spyOn(session, 'sendMessage').mockImplementation(async input => {
      modelIdAtSend = session.model.get();
      return originalSendMessage(input);
    });

    const selection = {
      modelId: packModel!.id,
      subagentModels: {
        explore: 'test/explore-model',
        plan: 'test/plan-model',
        execute: 'test/execute-model',
      },
      modelRoute: {
        entries: [{ id: 'custom:Test', label: 'Test', modelId: packModel!.id, memoryModelId: 'test/memory-model' }],
      },
    };
    const onApplied = vi.fn();

    const result = await runMC({
      controller,
      session,
      prompt: 'Use the pack',
      pack: {
        id: 'custom:Test',
        resolve: () => selection,
        onApplied,
      },
    }).result;

    expect(result.status).toBe('completed');
    expect(modelIdAtSend).toBe(packModel!.id);
    expect(onApplied).toHaveBeenCalledTimes(1);
    const threads = await session.thread.list();
    const thread = threads.find(t => t.id === result.threadId);
    expect((thread?.metadata as Record<string, unknown> | undefined)?.activeModelPackId).toBe('custom:Test');
    expect(session.subagents.model.get({ agentType: 'explore' })).toBe('test/explore-model');
    expect(session.subagents.model.get({ agentType: 'plan' })).toBe('test/plan-model');
    expect(session.subagents.model.get({ agentType: 'execute' })).toBe('test/execute-model');
    const state = session.state.get() as Record<string, unknown>;
    expect(state.modelRoute).toEqual({
      entries: [{ id: 'custom:Test', label: 'Test', modelId: packModel!.id, memoryModelId: 'test/memory-model' }],
    });
  });

  it('lets an explicit model override the pack model while the pack still applies', async () => {
    const { controller, session } = await makeHarness({
      doStream: async () => ({ stream: textStream('Overridden answer.') }),
    });
    const [packModel] = await controller.listAvailableModels();
    expect(packModel).toBeDefined();
    const explicitModel = { ...packModel!, id: 'test/explicit-model', hasApiKey: true };
    vi.spyOn(controller, 'listAvailableModels').mockResolvedValue([{ ...packModel!, hasApiKey: true }, explicitModel]);
    let modelIdAtSend: string | undefined;
    const originalSendMessage = session.sendMessage.bind(session);
    vi.spyOn(session, 'sendMessage').mockImplementation(async input => {
      modelIdAtSend = session.model.get();
      return originalSendMessage(input);
    });

    const result = await runMC({
      controller,
      session,
      prompt: 'Override the pack model',
      model: explicitModel.id,
      pack: {
        id: 'custom:Test',
        resolve: () => ({ modelId: packModel!.id, subagentModels: {}, modelRoute: { entries: [] } }),
      },
    }).result;

    expect(result.status).toBe('completed');
    expect(modelIdAtSend).toBe(explicitModel.id);
    const threads = await session.thread.list();
    const thread = threads.find(t => t.id === result.threadId);
    expect((thread?.metadata as Record<string, unknown> | undefined)?.activeModelPackId).toBe('custom:Test');
  });

  it('lets a pack override a restored thread model', async () => {
    const { controller, session } = await makeHarness({
      doStream: async () => ({ stream: textStream('Pack overrides restore.') }),
    });
    const restoredThreadId = session.thread.getId()!;
    await session.model.switch('anthropic/restored-model');
    await session.thread.create();

    const [packModel] = await controller.listAvailableModels();
    expect(packModel).toBeDefined();
    vi.spyOn(controller, 'listAvailableModels').mockResolvedValue([{ ...packModel!, hasApiKey: true }]);
    let modelIdAtSend: string | undefined;
    const originalSendMessage = session.sendMessage.bind(session);
    vi.spyOn(session, 'sendMessage').mockImplementation(async input => {
      modelIdAtSend = session.model.get();
      return originalSendMessage(input);
    });

    const result = await runMC({
      controller,
      session,
      prompt: 'Use the pack on the restored thread',
      thread: { id: restoredThreadId },
      pack: {
        id: 'custom:Test',
        resolve: () => ({ modelId: packModel!.id, subagentModels: {}, modelRoute: { entries: [] } }),
      },
    }).result;

    expect(result.status).toBe('completed');
    expect(result.threadId).toBe(restoredThreadId);
    expect(modelIdAtSend).toBe(packModel!.id);
    const threads = await session.thread.list();
    const thread = threads.find(t => t.id === restoredThreadId);
    expect((thread?.metadata as Record<string, unknown> | undefined)?.activeModelPackId).toBe('custom:Test');
  });

  it('resolves the pack against the mode a resumed thread restores', async () => {
    const { controller, session } = await makeHarness({
      doStream: async () => ({ stream: textStream('Resumed mode answer.') }),
    });
    const restoredThreadId = session.thread.getId()!;
    // Pin the thread to a non-startup mode, then move on so the resume
    // restores that mode during the run. Modes persist across thread.create,
    // so switch the fresh thread back explicitly.
    await session.mode.switch({ modeId: 'build' });
    await session.thread.create();
    await session.mode.switch({ modeId: 'default' });
    expect(session.mode.get()).toBe('default');

    const [packModel] = await controller.listAvailableModels();
    expect(packModel).toBeDefined();
    vi.spyOn(controller, 'listAvailableModels').mockResolvedValue([{ ...packModel!, hasApiKey: true }]);
    let modeSeenByResolve: string | undefined;

    const result = await runMC({
      controller,
      session,
      prompt: 'Pack on a resumed build thread',
      thread: { id: restoredThreadId },
      pack: {
        id: 'custom:Test',
        resolve: modeId => {
          modeSeenByResolve = modeId;
          return { modelId: packModel!.id, subagentModels: {}, modelRoute: { entries: [] } };
        },
      },
    }).result;

    expect(result.status).toBe('completed');
    expect(modeSeenByResolve).toBe('build');
  });

  it('fails without sending when the pack has no model for the selected mode', async () => {
    const { controller, session } = await makeHarness({
      doStream: async () => ({ stream: textStream('Should never be sent.') }),
    });
    const sendMessage = vi.spyOn(session, 'sendMessage');
    const onApplied = vi.fn();

    const result = await runMC({
      controller,
      session,
      prompt: 'Pack missing this mode',
      pack: {
        id: 'custom:Test',
        resolve: () => undefined,
        onApplied,
      },
    }).result;

    expect(result.status).toBe('error');
    expect(result.error?.message).toContain('custom:Test');
    expect(sendMessage).not.toHaveBeenCalled();
    expect(onApplied).not.toHaveBeenCalled();
  });

  it('yields controller events while iterating, then resolves', async () => {
    const { controller, session } = await makeHarness({ doStream: async () => ({ stream: textStream('Hi there') }) });

    const run = runMC({ controller, session, prompt: 'Greet me' });
    const types: string[] = [];
    for await (const event of run) {
      types.push(event.type);
    }
    const result = await run.result;

    expect(types).toContain('agent_start');
    expect(types).toContain('agent_end');
    expect(result.status).toBe('completed');
    expect(result.text).toBe('Hi there');
  });

  it('applies a tool approval policy and records tool calls', async () => {
    let call = 0;
    const { controller, session } = await makeHarness({
      withReadFileTool: true,
      readFileNeedsApproval: true,
      doStream: async () => {
        call++;
        return { stream: call === 1 ? toolCallStream() : textStream('Done reading') };
      },
    });

    const approvals: string[] = [];
    const policy: ResolutionPolicy = {
      onToolApproval: event => {
        approvals.push(event.toolName);
        return 'approve';
      },
      onSuspension: () => ({ resumeData: 'Yes' }),
    };

    const run = runMC({ controller, session, prompt: 'Read test.txt', policy });
    const result = await run.result;

    expect(result.status).toBe('completed');
    expect(approvals).toContain('readFile');
    expect(result.toolCalls.map(c => c.name)).toContain('readFile');
  });

  it('reports a cancelled startup as aborted without a startup error', async () => {
    const { controller, session } = await makeHarness({ doStream: async () => ({ stream: textStream('unused') }) });
    vi.spyOn(session, 'sendMessage').mockRejectedValueOnce(new SessionStartupCancelledError());

    const result = await runMC({ controller, session, prompt: 'Cancelled startup' }).result;

    expect(result.status).toBe('aborted');
    expect(result.exitCode).toBe(1);
    expect(result.error).toBeUndefined();
  });

  it.each([
    new DOMException('The operation was aborted.', 'AbortError'),
    Object.assign(new Error('MCP transport aborted during handshake'), { name: 'AbortError' }),
  ])('reports an unrelated startup AbortError as a failure: $message', async error => {
    const { controller, session } = await makeHarness({ doStream: async () => ({ stream: textStream('unused') }) });
    vi.spyOn(session, 'sendMessage').mockRejectedValueOnce(error);
    const result = await runMC({ controller, session, prompt: 'Transport failed' }).result;
    expect(result.status).toBe('error');
    expect(result.error?.message).toContain(error.message);
  });

  it('returns status "aborted" with exit code 1 when aborted', async () => {
    const { controller, session } = await makeHarness({
      doStream: async () => {
        await new Promise(r => setTimeout(r, 500));
        return { stream: textStream('too late') };
      },
    });

    const run = runMC({ controller, session, prompt: 'Slow task' });
    run.abort();
    const result = await run.result;

    expect(result.status).toBe('aborted');
    expect(result.exitCode).toBe(1);
  });

  it('returns status "aborted" when an external signal is already aborted', async () => {
    const { controller, session } = await makeHarness({
      doStream: async () => {
        await new Promise(r => setTimeout(r, 500));
        return { stream: textStream('too late') };
      },
    });

    const result = await runMC({ controller, session, prompt: 'Slow', signal: AbortSignal.abort() }).result;
    expect(result.status).toBe('aborted');
  });

  it('returns status "timeout" with exit code 2 when the timeout elapses', async () => {
    const { controller, session } = await makeHarness({
      doStream: async () => {
        await new Promise(r => setTimeout(r, 1000));
        return { stream: textStream('too late') };
      },
    });

    const run = runMC({ controller, session, prompt: 'Slow task', timeoutMs: 50 });
    const result = await run.result;

    expect(result.status).toBe('timeout');
    expect(result.exitCode).toBe(2);
  });

  it('returns a structured error result for an unknown model without mutating the session', async () => {
    const { controller, session } = await makeHarness({ doStream: async () => ({ stream: textStream('unused') }) });
    const initialResourceId = session.identity.getResourceId();
    const initialThreadId = session.thread.getId();
    const initialThreadIds = (await session.thread.list()).map(thread => thread.id);
    const initialModeId = session.mode.get();

    const result = await runMC({
      controller,
      session,
      prompt: 'x',
      resourceId: 'different-resource',
      mode: 'build',
      model: 'does-not-exist/model',
    }).result;

    expect(result.status).toBe('error');
    expect(result.exitCode).toBe(1);
    expect(result.error?.message).toMatch(/Unknown model/);
    expect(session.identity.getResourceId()).toBe(initialResourceId);
    expect(session.thread.getId()).toBe(initialThreadId);
    expect((await session.thread.list()).map(thread => thread.id)).toEqual(initialThreadIds);
    expect(session.mode.get()).toBe(initialModeId);
  });

  it('returns a structured error result when thread resolution fails', async () => {
    const { controller, session } = await makeHarness({ doStream: async () => ({ stream: textStream('unused') }) });

    const result = await runMC({
      controller,
      session,
      prompt: 'x',
      thread: { id: 'no-such-thread-or-title' },
    }).result;

    expect(result.status).toBe('error');
    expect(result.error?.message).toMatch(/No thread found/);
  });

  it('returns status "max_turns" with exit code 1 when the turn cap is hit mid-task', async () => {
    // First turn is a tool call, so the agent still has work to do when the
    // single-turn cap forces an abort. Later turns would produce text, but the
    // cap should stop the run before then.
    let call = 0;
    const { controller, session } = await makeHarness({
      withReadFileTool: true,
      doStream: async () => {
        call++;
        return { stream: call === 1 ? toolCallStream() : textStream('summary') };
      },
    });

    const run = runMC({ controller, session, prompt: 'Read then summarize', maxTurns: 1 });
    const result = await run.result;

    expect(result.status).toBe('max_turns');
    expect(result.exitCode).toBe(1);
  });

  it('completes normally when the run finishes within the turn cap', async () => {
    const { controller, session } = await makeHarness({
      doStream: async () => ({ stream: textStream('All done') }),
    });

    // Generous cap the single-turn run never reaches.
    const result = await runMC({ controller, session, prompt: 'One shot', maxTurns: 5 }).result;

    expect(result.status).toBe('completed');
    expect(result.exitCode).toBe(0);
    expect(result.text).toBe('All done');
  });

  it('does not call process.exit', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    try {
      const { controller, session } = await makeHarness({ doStream: async () => ({ stream: textStream('ok') }) });

      await runMC({ controller, session, prompt: 'hi' }).result;

      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
    }
  });
});
