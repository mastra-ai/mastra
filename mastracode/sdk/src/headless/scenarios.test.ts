/**
 * End-to-end scenario tests for the headless API.
 *
 * Unlike `run-mc.test.ts` (which exercises one runMC behavior per case), these
 * tests walk through realistic multi-step user journeys that compose the whole
 * pipeline — `runMC` + a {@link ResolutionPolicy} + the pure formatters — the
 * way a CLI session or a CI consumer actually would.
 */
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { Workspace } from '@mastra/core/workspace';
import { LibSQLStore } from '@mastra/libsql';
import { describe, it, expect, vi } from 'vitest';
import z from 'zod';

import { createHumanFormatState, formatHuman, formatJsonl, renderJsonResult, renderTextResult } from './format.js';
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

function toolCallStream(toolName: string, input: string) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'tool-call', toolCallId: 'call-1', toolName, input, providerExecuted: false });
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

describe('headless scenarios', () => {
  it('streams a turn to human stdout/stderr and renders a final text result', async () => {
    // A CLI user runs `mastracode --prompt ... --output human`: assistant text
    // streams to stdout as it arrives, then the final result is rendered.
    const { controller, session } = await makeHarness({
      doStream: async () => ({ stream: textStream('The answer is 4.') }),
    });

    const run = runMC({ controller, session, prompt: 'What is 2+2?' });

    const state = createHumanFormatState();
    let stdout = '';
    let stderr = '';
    for await (const event of run) {
      const out = formatHuman(event, state);
      if (out.stdout) stdout += out.stdout;
      if (out.stderr) stderr += out.stderr;
    }
    const result = await run.result;

    expect(result.status).toBe('completed');
    expect(stdout).toContain('The answer is 4.');
    expect(stderr).toBe('');
    expect(renderTextResult(result)).toBe('The answer is 4.\n');
  });

  it('runs a tool, approves it, and produces a machine-readable JSON result', async () => {
    // A CI consumer runs a tool-using task and reads the structured JSON result.
    let call = 0;
    const { controller, session } = await makeHarness({
      withReadFileTool: true,
      readFileNeedsApproval: true,
      doStream: async () => {
        call++;
        return {
          stream: call === 1 ? toolCallStream('readFile', '{"path":"notes.txt"}') : textStream('Read the notes.'),
        };
      },
    });

    const run = runMC({ controller, session, prompt: 'Read notes.txt' });
    const result = await run.result;

    expect(result.status).toBe('completed');
    expect(result.toolCalls.map(c => c.name)).toContain('readFile');
    expect(result.toolResults.length).toBeGreaterThan(0);

    const json = JSON.parse(renderJsonResult(result));
    expect(json.text).toBe('Read the notes.');
    expect(json.toolCalls[0].name).toBe('readFile');
    expect(json.usage).toEqual({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
    expect(json.threadId).toBeTruthy();
  });

  it('emits one JSONL object per controller event for a streaming consumer', async () => {
    // `--output jsonl`: every event becomes a newline-delimited JSON object.
    const { controller, session } = await makeHarness({
      doStream: async () => ({ stream: textStream('Hello') }),
    });

    const run = runMC({ controller, session, prompt: 'Greet me' });
    const lines: Record<string, unknown>[] = [];
    for await (const event of run) {
      lines.push(formatJsonl(event));
    }
    await run.result;

    // Each line is a faithful, serializable copy of the event.
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.map(l => l.type)).toContain('agent_start');
    expect(lines.map(l => l.type)).toContain('agent_end');
    for (const line of lines) {
      expect(() => JSON.parse(JSON.stringify(line))).not.toThrow();
    }
  });

  it('honors a strict CI policy that denies approvals', async () => {
    // A CI consumer supplies a policy that refuses every tool approval. The run
    // still completes (the agent moves on) but the policy is consulted.
    let call = 0;
    const { controller, session } = await makeHarness({
      withReadFileTool: true,
      readFileNeedsApproval: true,
      doStream: async () => {
        call++;
        return {
          stream: call === 1 ? toolCallStream('readFile', '{"path":"secret.txt"}') : textStream('Cannot read it.'),
        };
      },
    });

    const denied: string[] = [];
    const denyPolicy: ResolutionPolicy = {
      onToolApproval: event => {
        denied.push(event.toolName);
        return 'deny';
      },
      onSuspension: () => ({ abort: true }),
    };

    const run = runMC({ controller, session, prompt: 'Read secret.txt', policy: denyPolicy });
    const result = await run.result;

    expect(denied).toContain('readFile');
    expect(result.exitCode).toBe(0);
    expect(result.status).toBe('completed');
  });

  it('continues an existing thread across two runs and preserves the thread id', async () => {
    // First run creates/uses a thread; a second run targets the same thread by
    // id and keeps writing to it — the typical `--continue` / `--thread` flow.
    let call = 0;
    const { controller, session } = await makeHarness({
      doStream: async () => {
        call++;
        return { stream: textStream(call === 1 ? 'First answer.' : 'Second answer.') };
      },
    });

    const first = await runMC({ controller, session, prompt: 'First question' }).result;
    expect(first.status).toBe('completed');
    const threadId = first.threadId!;
    expect(threadId).toBeTruthy();

    const second = await runMC({
      controller,
      session,
      prompt: 'Follow-up question',
      thread: { id: threadId },
    }).result;

    expect(second.status).toBe('completed');
    expect(second.text).toBe('Second answer.');
    expect(second.threadId).toBe(threadId);
  });

  it('reports a timeout as a non-zero exit without throwing, for CI gating', async () => {
    // A CI job sets a timeout; a slow run must surface as a clean exit code 2
    // rather than a thrown error or a process exit.
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    try {
      const { controller, session } = await makeHarness({
        doStream: async () => {
          await new Promise(r => setTimeout(r, 1000));
          return { stream: textStream('too late') };
        },
      });

      const result = await runMC({ controller, session, prompt: 'Slow task', timeoutMs: 50 }).result;

      expect(result.status).toBe('timeout');
      expect(result.exitCode).toBe(2);
      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
    }
  });

  it('collects events and the final result on the same run handle', async () => {
    // Both iteration and awaiting must observe the same single run.
    const { controller, session } = await makeHarness({
      doStream: async () => ({ stream: textStream('Done.') }),
    });

    const run = runMC({ controller, session, prompt: 'Do it' });
    const events: AgentControllerEvent[] = [];
    for await (const event of run) {
      events.push(event);
    }
    const result = await run.result;

    expect(events.length).toBeGreaterThan(0);
    expect(events.at(-1)?.type).toBe('agent_end');
    expect(result.text).toBe('Done.');
    expect(result.status).toBe('completed');
  });
});
