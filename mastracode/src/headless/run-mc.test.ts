import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { Workspace } from '@mastra/core/workspace';
import { LibSQLStore } from '@mastra/libsql';
import { describe, it, expect, vi } from 'vitest';
import z from 'zod';

import { runMC } from './run-mc.js';
import type { ResolutionPolicy } from './types.js';

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

  it('returns a structured error result for an unknown model (no throw)', async () => {
    const { controller, session } = await makeHarness({ doStream: async () => ({ stream: textStream('unused') }) });

    const result = await runMC({ controller, session, prompt: 'x', model: 'does-not-exist/model' }).result;

    expect(result.status).toBe('error');
    expect(result.exitCode).toBe(1);
    expect(result.error?.message).toMatch(/Unknown model/);
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
