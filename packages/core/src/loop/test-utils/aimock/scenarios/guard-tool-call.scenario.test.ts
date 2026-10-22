import { createOpenAI } from '@ai-sdk/openai-v5';
import type { LLMock } from '@copilotkit/aimock';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import type { ToolsInput } from '../../../../agent';
import { Mastra } from '../../../../mastra';
import { InMemoryStore } from '../../../../storage';
import { createTool } from '../../../../tools';
import type { ToolCallGuard, ToolCallGuardContext, ToolHooks } from '../../../../tools/types';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * A coding agent may read files freely and run shell commands, but a guard decides each shell
 * command against what the user actually asked for: harmless commands run, destructive ones are
 * refused with a reason the model can act on, and anything the guard is unsure about goes to a
 * person. Approval rules the user configured always win over the guard, a refused call never
 * blocks its siblings, and a model that keeps retrying refused commands ends up in front of a
 * person rather than looping forever. Each engine must behave the same, or a destructive command
 * can run without review.
 */

const PROMPT = 'Clean up the build output in this repo.';

function shellTools(opts: { requireApproval?: boolean; guard?: ToolCallGuard } = {}) {
  const executed: string[] = [];
  const runShell = createTool({
    id: 'runShell',
    description: 'Run a shell command.',
    inputSchema: z.object({ command: z.string() }),
    outputSchema: z.object({ stdout: z.string() }),
    ...(opts.requireApproval ? { requireApproval: true } : {}),
    ...(opts.guard ? { guard: opts.guard } : {}),
    execute: async ({ command }) => {
      executed.push(`runShell:${command}`);
      return { stdout: `ran ${command}` };
    },
  });
  const readFile = createTool({
    id: 'readFile',
    description: 'Read a file.',
    inputSchema: z.object({ path: z.string() }),
    outputSchema: z.object({ content: z.string() }),
    execute: async ({ path }) => {
      executed.push(`readFile:${path}`);
      return { content: `contents of ${path}` };
    },
  });
  return { tools: { runShell, readFile } as ToolsInput, executed };
}

/** Destructive commands are refused; `rm -rf dist` is allowed; anything else needs a person. */
const shellGuard: ToolCallGuard = ({ toolName, args }) => {
  if (toolName !== 'runShell') return { action: 'allow' };
  const { command } = args as { command: string };
  if (command === 'rm -rf dist') return { action: 'allow' };
  if (command.startsWith('rm -rf /')) return { action: 'deny', reason: 'Deleting the filesystem root is not allowed.' };
  return { action: 'ask' };
};

let guardedAgentCounter = 0;

/** The harness has no `hooks` option, so build the AIMock-backed agent here and pass it as `sharedAgent`. */
function buildGuardedAgent(
  llm: LLMock,
  { tools, hooks, executionHooks }: { tools: ToolsInput; hooks?: ToolHooks; executionHooks?: ToolHooks },
): { agent: Agent; mastra: Mastra } {
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
  const id = `guard-tool-call-scenario-agent-${++guardedAgentCounter}`;
  const agent = new Agent({
    id,
    name: id,
    instructions: 'You are a test agent driven by scripted AIMock responses.',
    model: openai(SCENARIO_MODEL_ID),
    tools,
    ...(hooks ? { hooks } : {}),
    ...(executionHooks ? { defaultOptions: { hooks: executionHooks } } : {}),
  });
  const mastra = new Mastra({ agents: { [id]: agent }, logger: false, storage: new InMemoryStore() });
  return { agent: mastra.getAgent(id), mastra };
}

const shell = (id: string, command: string) => ({ id, name: 'runShell', arguments: { command } });

describeForAllEngines('AIMock loop scenario: guardToolCall', engine => {
  const getMock = useLoopScenarioAimock();

  it('runs a call the guard allows, and gives the guard only the user messages by default', async () => {
    const { tools, executed } = shellTools();
    const guard = vi.fn(shellGuard);

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: buildGuardedAgent(getMock(), { tools, hooks: { guardToolCall: guard } }),
      prompt: PROMPT,
      stopWhen: stepCountIs(5),
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [shell('call-rm-dist', 'rm -rf dist')] });
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Removed the build output.' });
      },
    });

    expect(await output.text).toContain('Removed the build output.');
    expect(executed).toEqual(['runShell:rm -rf dist']);
    expect(chunks!.some(c => c.type === 'tool-call-approval')).toBe(false);

    expect(guard).toHaveBeenCalledTimes(1);
    const ctx = guard.mock.calls[0]![0] as ToolCallGuardContext;
    expect(ctx).toMatchObject({
      toolName: 'runShell',
      toolCallId: 'call-rm-dist',
      args: { command: 'rm -rf dist' },
      declines: { consecutive: 0, total: 0 },
    });
    expect(ctx.messages).toBeUndefined();
    expect(ctx.userMessages.length).toBeGreaterThan(0);
    expect(ctx.userMessages.every(m => m.role === 'user')).toBe(true);
    expect(JSON.stringify(ctx.userMessages)).toContain(PROMPT);
  });

  it('refuses a denied call with its reason, while the other calls in the same step still run', async () => {
    const { tools, executed } = shellTools();
    const llm = getMock();

    const { output, chunks } = await runLoopScenario({
      engine,
      llm,
      sharedAgent: buildGuardedAgent(llm, { tools, hooks: { guardToolCall: shellGuard } }),
      prompt: PROMPT,
      stopWhen: stepCountIs(5),
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              shell('call-rm-root', 'rm -rf /'),
              { id: 'call-read', name: 'readFile', arguments: { path: 'package.json' } },
            ],
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'I will not delete the root.' });
      },
    });

    expect(await output.text).toContain('I will not delete the root.');
    expect(executed).toEqual(['readFile:package.json']);
    expect(chunks!.some(c => c.type === 'tool-call-approval')).toBe(false);

    const denied = chunks!.find(c => c.type === 'tool-output-denied') as any;
    expect(denied?.payload).toMatchObject({
      toolCallId: 'call-rm-root',
      approval: { approved: false, reason: 'Deleting the filesystem root is not allowed.' },
    });

    // The model sees the guard's reason in place of a result.
    const followUp = JSON.stringify(llm.getRequests()[1]!.body!.messages);
    expect(followUp).toContain('Deleting the filesystem root is not allowed.');
    expect(followUp).toContain('contents of package.json');
  });

  it('sends a call the guard is unsure about to a person, and does not re-run the guard on approval', async () => {
    const { tools, executed } = shellTools();
    const guard = vi.fn(shellGuard);
    const shared = buildGuardedAgent(getMock(), { tools, hooks: { guardToolCall: guard } });

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: PROMPT,
      stopWhen: stepCountIs(5),
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [shell('call-clean', 'git clean -fdx')] });
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Cleaned the repo.' });
      },
    });

    const approval = chunks!.find(c => c.type === 'tool-call-approval') as any;
    expect(approval?.payload).toMatchObject({ toolCallId: 'call-clean', toolName: 'runShell' });
    expect(executed).toEqual([]);

    const resumed = await (shared.agent as any).approveToolCall({ runId: output.runId, toolCallId: 'call-clean' });
    const resumedOutput = resumed.output ?? resumed;
    for await (const _ of resumed.fullStream) {
      // drain
    }

    expect(await resumedOutput.text).toContain('Cleaned the repo.');
    expect(executed).toEqual(['runShell:git clean -fdx']);
    expect(guard).toHaveBeenCalledTimes(1);
  });

  it('skips the guard when an approval rule already requires a person', async () => {
    const { tools, executed } = shellTools({ requireApproval: true });
    const guard = vi.fn(shellGuard);

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: buildGuardedAgent(getMock(), { tools, hooks: { guardToolCall: guard } }),
      prompt: PROMPT,
      stopWhen: stepCountIs(5),
      collectChunks: true,
      fixtures: llm => {
        // The guard would allow this command; the tool's own rule still asks a person.
        llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [shell('call-rm-dist', 'rm -rf dist')] });
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Removed the build output.' });
      },
    });

    expect(chunks!.some(c => c.type === 'tool-call-approval')).toBe(true);
    expect(executed).toEqual([]);
    expect(guard).not.toHaveBeenCalled();
  });

  it('sends a person the next refused call once the model keeps retrying refused commands', async () => {
    const { tools, executed } = shellTools();
    const guard = vi.fn(shellGuard);

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: buildGuardedAgent(getMock(), {
        tools,
        hooks: { guardToolCall: guard, guardToolCallOptions: { escalation: { consecutive: 1 } } },
      }),
      prompt: PROMPT,
      stopWhen: stepCountIs(5),
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [shell('call-root-1', 'rm -rf /')] });
        llm.on(
          { endpoint: 'chat', toolCallId: 'call-root-1', hasToolResult: true },
          { toolCalls: [shell('call-root-2', 'rm -rf /*')] },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call-root-2', hasToolResult: true }, { content: 'Done.' });
      },
    });

    const denied = chunks!.filter(c => c.type === 'tool-output-denied').map(c => (c as any).payload.toolCallId);
    expect(denied).toEqual(['call-root-1']);
    const approval = chunks!.find(c => c.type === 'tool-call-approval') as any;
    expect(approval?.payload).toMatchObject({ toolCallId: 'call-root-2' });
    expect(executed).toEqual([]);

    expect(guard).toHaveBeenCalledTimes(2);
    expect((guard.mock.calls[1]![0] as ToolCallGuardContext).declines).toEqual({ consecutive: 1, total: 1 });
  });

  it('gives the guard the full conversation when includeUntrustedContext is set', async () => {
    const { tools } = shellTools();
    const guard = vi.fn(shellGuard);

    await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: buildGuardedAgent(getMock(), {
        tools,
        hooks: { guardToolCall: guard, guardToolCallOptions: { includeUntrustedContext: true } },
      }),
      prompt: PROMPT,
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [shell('call-rm-dist', 'rm -rf dist')] });
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Removed the build output.' });
      },
    });

    expect(guard).toHaveBeenCalledTimes(1);
    const ctx = guard.mock.calls[0]![0] as ToolCallGuardContext;
    expect(ctx.messages).toBeDefined();
    expect(JSON.stringify(ctx.messages)).toContain(PROMPT);
  });

  /** Resumes the suspended call with a person answer and drains the resumed stream. */
  async function answer(agent: Agent, runId: string, toolCallId: string, approved: boolean) {
    const resumed = approved
      ? await (agent as any).approveToolCall({ runId, toolCallId })
      : await (agent as any).declineToolCall({ runId, toolCallId, reason: 'Not that.' });
    const chunks: any[] = [];
    for await (const chunk of resumed.fullStream) chunks.push(chunk);
    return chunks;
  }

  it('keeps the run denial total across a suspend and resume, so the total threshold still applies', async () => {
    const { tools, executed } = shellTools();
    const guard = vi.fn(shellGuard);
    const shared = buildGuardedAgent(getMock(), {
      tools,
      hooks: { guardToolCall: guard, guardToolCallOptions: { escalation: { total: 1 } } },
    });

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: PROMPT,
      stopWhen: stepCountIs(6),
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [shell('call-root-1', 'rm -rf /')] });
        llm.on(
          { endpoint: 'chat', toolCallId: 'call-root-1', hasToolResult: true },
          { toolCalls: [shell('call-clean', 'git clean -fdx')] },
        );
        llm.on(
          { endpoint: 'chat', toolCallId: 'call-clean', hasToolResult: true },
          { toolCalls: [shell('call-root-2', 'rm -rf /*')] },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call-root-2', hasToolResult: true }, { content: 'Done.' });
      },
    });

    expect(chunks!.filter(c => c.type === 'tool-output-denied').map(c => (c as any).payload.toolCallId)).toEqual([
      'call-root-1',
    ]);
    expect(chunks!.find(c => c.type === 'tool-call-approval')?.payload).toMatchObject({ toolCallId: 'call-clean' });

    const resumedChunks = await answer(shared.agent, output.runId, 'call-clean', true);

    expect(executed).toEqual(['runShell:git clean -fdx']);
    // One denial already happened before the suspend; the next refused call goes to a person.
    expect(resumedChunks.some(c => c.type === 'tool-output-denied')).toBe(false);
    expect(resumedChunks.find(c => c.type === 'tool-call-approval')?.payload).toMatchObject({
      toolCallId: 'call-root-2',
    });
    // The person answered the `ask`, so only the consecutive count reset.
    expect((guard.mock.calls.at(-1)![0] as ToolCallGuardContext).declines).toEqual({ consecutive: 0, total: 1 });
  });

  it('resets only the consecutive count once a person answers an ask', async () => {
    const { tools, executed } = shellTools();
    const guard = vi.fn(shellGuard);
    const shared = buildGuardedAgent(getMock(), {
      tools,
      hooks: { guardToolCall: guard, guardToolCallOptions: { escalation: { consecutive: 1 } } },
    });

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: PROMPT,
      stopWhen: stepCountIs(6),
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [shell('call-root-1', 'rm -rf /')] });
        llm.on(
          { endpoint: 'chat', toolCallId: 'call-root-1', hasToolResult: true },
          { toolCalls: [shell('call-root-2', 'rm -rf /*')] },
        );
        llm.on(
          { endpoint: 'chat', toolCallId: 'call-root-2', hasToolResult: true },
          { toolCalls: [shell('call-root-3', 'rm -rf /')] },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call-root-3', hasToolResult: true }, { content: 'Done.' });
      },
    });

    // The second refusal in a row escalated to a person.
    expect(chunks!.find(c => c.type === 'tool-call-approval')?.payload).toMatchObject({ toolCallId: 'call-root-2' });

    const resumedChunks = await answer(shared.agent, output.runId, 'call-root-2', false);

    expect(executed).toEqual([]);
    // After the person answered, the next refusal is a plain deny again, and the total kept counting.
    expect(resumedChunks.some(c => c.type === 'tool-call-approval')).toBe(false);
    const denied = resumedChunks.filter(c => c.type === 'tool-output-denied').map(c => c.payload.toolCallId);
    expect(denied).toContain('call-root-3');
    expect((guard.mock.calls.at(-1)![0] as ToolCallGuardContext).declines).toEqual({ consecutive: 0, total: 1 });
  });

  it('lets a tool guard alone allow, deny with a reason, or ask', async () => {
    const { tools, executed } = shellTools({ guard: shellGuard });
    const llm = getMock();

    const { chunks } = await runLoopScenario({
      engine,
      llm,
      sharedAgent: buildGuardedAgent(llm, { tools }),
      prompt: PROMPT,
      stopWhen: stepCountIs(5),
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [shell('call-rm-dist', 'rm -rf dist'), shell('call-rm-root', 'rm -rf /')],
          },
        );
        llm.on(
          { endpoint: 'chat', toolCallId: 'call-rm-root', hasToolResult: true },
          { toolCalls: [shell('call-clean', 'git clean -fdx')] },
        );
      },
    });

    expect(executed).toEqual(['runShell:rm -rf dist']);
    const denied = chunks!.find(c => c.type === 'tool-output-denied') as any;
    expect(denied?.payload).toMatchObject({
      toolCallId: 'call-rm-root',
      approval: { approved: false, reason: 'Deleting the filesystem root is not allowed.' },
    });
    expect(chunks!.find(c => c.type === 'tool-call-approval')?.payload).toMatchObject({ toolCallId: 'call-clean' });
  });

  it('lets an agent guard deny override a tool guard that would allow', async () => {
    const toolGuard = vi.fn<ToolCallGuard>(() => ({ action: 'allow' }));
    const { tools, executed } = shellTools({ guard: toolGuard });

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: buildGuardedAgent(getMock(), {
        tools,
        hooks: { guardToolCall: () => ({ action: 'deny', reason: 'The agent forbids shell access.' }) },
      }),
      prompt: PROMPT,
      stopWhen: stepCountIs(5),
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [shell('call-rm-dist', 'rm -rf dist')] });
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
      },
    });

    expect(executed).toEqual([]);
    expect((chunks!.find(c => c.type === 'tool-output-denied') as any)?.payload.approval.reason).toBe(
      'The agent forbids shell access.',
    );
    expect(toolGuard).not.toHaveBeenCalled();
  });

  it('lets a tool guard deny a call the agent guard allowed', async () => {
    const { tools, executed } = shellTools({ guard: shellGuard });
    const agentGuard = vi.fn<ToolCallGuard>(() => ({ action: 'allow' }));

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: buildGuardedAgent(getMock(), { tools, hooks: { guardToolCall: agentGuard } }),
      prompt: PROMPT,
      stopWhen: stepCountIs(5),
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [shell('call-rm-root', 'rm -rf /')] });
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
      },
    });

    expect(agentGuard).toHaveBeenCalledTimes(1);
    expect(executed).toEqual([]);
    expect((chunks!.find(c => c.type === 'tool-output-denied') as any)?.payload.approval.reason).toBe(
      'Deleting the filesystem root is not allowed.',
    );
  });

  it('skips a tool guard when an approval rule already requires a person', async () => {
    const toolGuard = vi.fn(shellGuard);
    const { tools, executed } = shellTools({ requireApproval: true, guard: toolGuard });

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: buildGuardedAgent(getMock(), { tools }),
      prompt: PROMPT,
      stopWhen: stepCountIs(5),
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [shell('call-rm-root', 'rm -rf /')] });
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
      },
    });

    expect(chunks!.find(c => c.type === 'tool-call-approval')?.payload).toMatchObject({ toolCallId: 'call-rm-root' });
    expect(chunks!.some(c => c.type === 'tool-output-denied')).toBe(false);
    expect(executed).toEqual([]);
    expect(toolGuard).not.toHaveBeenCalled();
  });

  // Durable and evented drop all per-execution hooks: Agent.getToolsForExecution never forwards
  // `hooks` to convertTools (#27430).
  const itPerExecutionHooks = engine === 'durable' || engine === 'evented' ? it.fails : it;

  itPerExecutionHooks('applies a guard set as a per-execution hook', async () => {
    const { tools, executed } = shellTools();

    await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: buildGuardedAgent(getMock(), { tools, executionHooks: { guardToolCall: shellGuard } }),
      prompt: PROMPT,
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [shell('call-rm-root', 'rm -rf /')] });
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'I will not delete the root.' });
      },
    });

    expect(executed).toEqual([]);
  });
});
