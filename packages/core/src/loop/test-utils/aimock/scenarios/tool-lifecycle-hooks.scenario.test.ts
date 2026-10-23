import { createOpenAI } from '@ai-sdk/openai-v5';
import type { LLMock } from '@copilotkit/aimock';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import type { ToolsInput } from '../../../../agent';
import type { DurableAgentStreamOptions } from '../../../../agent/durable/durable-agent';
import { Mastra } from '../../../../mastra';
import { MockMemory } from '../../../../memory/mock';
import type { Processor } from '../../../../processors';
import { RequestContext } from '../../../../request-context';
import { InMemoryStore } from '../../../../storage';
import { createTool } from '../../../../tools';
import type { ToolHooks } from '../../../../tools/types';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Regression class: tool lifecycle hooks (onInputAvailable, onOutput).
 *
 * Per-tool lifecycle hooks let users intercept execution: `onInputAvailable`
 * fires once the parsed input is available (before `execute` runs), and
 * `onOutput` fires after `execute` resolves (before the tool result is fed back
 * to the model). A refactor to tool-call-step that stops wiring these hooks
 * through would silently break observability / side-effect use cases. These
 * scenarios pin the invocation contract, along with agent-level and
 * per-execution `beforeToolCall` / `afterToolCall` hooks.
 */
describeForAllEngines('AIMock loop scenario: tool lifecycle hooks', engine => {
  const getMock = useLoopScenarioAimock();

  it('invokes onInputAvailable before execute and onOutput after execute', async () => {
    const events: string[] = [];

    const tracedTool = createTool({
      id: 'traced_tool',
      description: 'A tool with lifecycle hooks.',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ answer: z.string() }),
      onInputAvailable: vi.fn(async ({ input }) => {
        events.push(`input:${(input as { query: string }).query}`);
      }),
      onOutput: vi.fn(async ({ output, toolName }) => {
        events.push(`output:${toolName}:${(output as { answer: string }).answer}`);
      }),
      execute: async ({ query }) => {
        events.push(`execute:${query}`);
        return { answer: `replied to ${query}` };
      },
    });

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Answer the question.',
      tools: { traced_tool: tracedTool },
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        // Turn 1: call the traced tool.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_traced', name: 'traced_tool', arguments: { query: 'hello' } }] },
        );
        // Turn 2: wrap up after tool result.
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_traced', hasToolResult: true },
          { content: 'The tool replied: replied to hello' },
        );
      },
    });

    // The run completed with the final text.
    const text = await output.text;
    expect(text).toContain('replied to hello');

    // Two turns: tool call, then final text.
    expect(requests).toHaveLength(2);

    // Both hooks fired and in the expected order: input -> execute -> output.
    expect(events).toEqual(['input:hello', 'execute:hello', 'output:traced_tool:replied to hello']);
  });

  it('still runs execute and surfaces a result if onInputAvailable throws', async () => {
    const events: string[] = [];

    const flakyHookTool = createTool({
      id: 'flaky_hook_tool',
      description: 'A tool whose onInputAvailable throws.',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      onInputAvailable: vi.fn(async () => {
        events.push('onInputAvailable:throw');
        throw new Error('HOOK_BOOM');
      }),
      onOutput: vi.fn(async () => {
        events.push('onOutput:called');
      }),
      execute: async () => {
        events.push('execute:ran');
        return { ok: true };
      },
    });

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Call the tool.',
      tools: { flaky_hook_tool: flakyHookTool },
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_fh', name: 'flaky_hook_tool', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Tool finished.' });
      },
    });

    // The hook threw but execute still ran and the loop finished.
    expect(requests).toHaveLength(2);
    expect(events).toContain('onInputAvailable:throw');
    expect(events).toContain('execute:ran');
    expect(events).toContain('onOutput:called');

    const text = await output.text;
    expect(text).toContain('finished');
  });

  it('runs agent-level beforeToolCall and afterToolCall around execute', async () => {
    const events: Array<{ phase: string; toolName: string; input: unknown; output?: unknown }> = [];
    const lookupTool = createTool({
      id: 'lookup_tool',
      description: 'Looks up a value.',
      inputSchema: z.object({ key: z.string() }),
      execute: async ({ key }) => {
        events.push({ phase: 'execute', toolName: 'lookup_tool', input: { key } });
        return { value: `value-of-${key}` };
      },
    });
    const llm = getMock();

    const { output, requests } = await runLoopScenario({
      engine,
      llm,
      prompt: 'Look up alpha.',
      stopWhen: stepCountIs(5),
      sharedAgent: buildHookedAgent(llm, {
        tools: { lookup_tool: lookupTool },
        hooks: {
          beforeToolCall: ({ toolName, input }) => {
            events.push({ phase: 'before', toolName, input });
          },
          afterToolCall: ({ toolName, input, output }) => {
            events.push({ phase: 'after', toolName, input, output });
          },
        },
      }),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_lookup', name: 'lookup_tool', arguments: { key: 'alpha' } }] },
        );
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_lookup', hasToolResult: true },
          { content: 'alpha is value-of-alpha' },
        );
      },
    });

    expect(await output.text).toContain('value-of-alpha');
    expect(requests).toHaveLength(2);
    expect(events).toEqual([
      { phase: 'before', toolName: 'lookup_tool', input: { key: 'alpha' } },
      { phase: 'execute', toolName: 'lookup_tool', input: { key: 'alpha' } },
      { phase: 'after', toolName: 'lookup_tool', input: { key: 'alpha' }, output: { value: 'value-of-alpha' } },
    ]);
  });

  it('lets per-execution beforeToolCall override the agent hook and short-circuit execute', async () => {
    const agentBeforeToolCall = vi.fn();
    const runBeforeToolCall = vi.fn(() => ({ proceed: false as const, output: { value: 'blocked-by-hook' } }));
    const execute = vi.fn(async () => ({ value: 'executed' }));
    const guardedTool = createTool({
      id: 'guarded_tool',
      description: 'A tool a hook can block.',
      inputSchema: z.object({ key: z.string() }),
      execute,
    });
    const llm = getMock();

    const { output, requests } = await runLoopScenario({
      engine,
      llm,
      prompt: 'Run the guarded tool.',
      stopWhen: stepCountIs(5),
      sharedAgent: buildHookedAgent(llm, {
        tools: { guarded_tool: guardedTool },
        hooks: { beforeToolCall: agentBeforeToolCall },
        executionHooks: { beforeToolCall: runBeforeToolCall },
      }),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_guarded', name: 'guarded_tool', arguments: { key: 'beta' } }] },
        );
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_guarded', hasToolResult: true },
          { content: 'The hook blocked it.' },
        );
      },
    });

    expect(await output.text).toContain('blocked');
    expect(requests).toHaveLength(2);
    expect(execute).not.toHaveBeenCalled();
    expect(agentBeforeToolCall).not.toHaveBeenCalled();
    expect(runBeforeToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'guarded_tool', input: { key: 'beta' } }),
    );
    // The hook's substitute output is what the model sees as the tool result.
    expect(JSON.stringify(requests[1]!.body.messages)).toContain('blocked-by-hook');
  });

  it('uses call-time hooks instead of default and agent hooks on every engine', async () => {
    const agentBefore = vi.fn();
    const defaultBefore = vi.fn();
    const defaultAfter = vi.fn();
    const callBefore = vi.fn();
    const callAfter = vi.fn();
    const callOptions = {
      hooks: { beforeToolCall: callBefore, afterToolCall: callAfter },
    } satisfies DurableAgentStreamOptions;
    const execute = vi.fn(async () => ({ value: 'call-only' }));
    const llm = getMock();
    const tool = createTool({
      id: 'guarded_tool',
      description: 'A guarded tool.',
      inputSchema: z.object({ key: z.string() }),
      execute,
    });

    const { requests } = await runLoopScenario({
      engine,
      llm,
      prompt: 'Call the guarded tool.',
      sharedAgent: buildHookedAgent(llm, {
        tools: { guarded_tool: tool },
        hooks: { beforeToolCall: agentBefore },
        executionHooks: { beforeToolCall: defaultBefore, afterToolCall: defaultAfter },
      }),
      hooks: callOptions.hooks,
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_guarded', name: 'guarded_tool', arguments: { key: 'alpha' } }] },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call_guarded', hasToolResult: true }, { content: 'Done.' });
      },
    });

    expect(requests).toHaveLength(2);
    expect(callBefore).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'guarded_tool', input: { key: 'alpha' } }),
    );
    expect(callAfter).toHaveBeenCalledTimes(1);
    expect(callAfter).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'guarded_tool', output: { value: 'call-only' } }),
    );
    expect(defaultBefore).not.toHaveBeenCalled();
    expect(defaultAfter).not.toHaveBeenCalled();
    expect(agentBefore).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(requests[1]!.body.messages)).toContain('call-only');
  });

  it('uses call-time hooks passed to generate()', async () => {
    const llm = getMock();
    const defaultBefore = vi.fn();
    const callBefore = vi.fn(() => ({ proceed: false as const, output: { value: 'blocked-by-generate' } }));
    const execute = vi.fn(async () => ({ value: 'executed' }));
    const tool = createTool({
      id: 'guarded_tool',
      description: 'A guarded tool.',
      inputSchema: z.object({ key: z.string() }),
      execute,
    });
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call_generate', name: 'guarded_tool', arguments: { key: 'delta' } }] },
    );
    llm.on({ endpoint: 'chat', toolCallId: 'call_generate', hasToolResult: true }, { content: 'Generate blocked.' });
    const { agent } = await createSharedAgent(llm, {
      engine,
      tools: { guarded_tool: tool },
      defaultOptions: { hooks: { beforeToolCall: defaultBefore } },
    });

    const result = await agent.generate('Call the guarded tool.', {
      hooks: { beforeToolCall: callBefore },
      stopWhen: stepCountIs(5),
    });

    expect(result.text).toContain('Generate blocked');
    expect(callBefore).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'guarded_tool', input: { key: 'delta' } }),
    );
    expect(defaultBefore).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    expect(JSON.stringify(llm.getRequests()[1]?.body.messages)).toContain('blocked-by-generate');
  });

  if (engine === 'durable' || engine === 'evented' || engine === 'inngest') {
    it('uses hooks supplied only on warm resume for a suspended tool', async () => {
      const llm = getMock();
      const defaultBefore = vi.fn();
      const resumeBefore = vi.fn(() => ({ proceed: false as const, output: { value: 'blocked-on-resume' } }));
      const execute = vi.fn(async (_input: { key: string }, context) => {
        if (!context?.agent?.resumeData) return context?.agent?.suspend({ waiting: true });
        return { value: 'executed-on-resume' };
      });
      const tool = createTool({
        id: 'guarded_tool',
        description: 'A tool suspended before resuming.',
        inputSchema: z.object({ key: z.string() }),
        suspendSchema: z.object({ waiting: z.boolean() }),
        resumeSchema: z.object({ approved: z.boolean() }),
        execute,
      });
      const shared = await createSharedAgent(llm, {
        engine,
        tools: { guarded_tool: tool },
        defaultOptions: { hooks: { beforeToolCall: defaultBefore } },
      });
      const { output, chunks } = await runLoopScenario({
        engine,
        llm,
        sharedAgent: shared,
        prompt: 'Call the guarded tool.',
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_guarded', name: 'guarded_tool', arguments: { key: 'alpha' } }] },
          );
          llm.on({ endpoint: 'chat', toolCallId: 'call_guarded', hasToolResult: true }, { content: 'Done.' });
        },
      });
      expect(chunks?.some(chunk => chunk.type === 'tool-call-suspended')).toBe(true);
      expect(execute).toHaveBeenCalledTimes(1);
      expect(defaultBefore).toHaveBeenCalledTimes(1);

      const resumed = await shared.agent.resumeStream(
        { approved: true },
        {
          runId: output.runId,
          hooks: { beforeToolCall: resumeBefore },
        },
      );
      for await (const _chunk of resumed.fullStream) {
        /* drain */
      }

      expect(resumeBefore).toHaveBeenCalledWith(
        expect.objectContaining({ toolName: 'guarded_tool', input: { key: 'alpha' } }),
      );
      expect(defaultBefore).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(llm.getRequests()[1]?.body.messages)).toContain('blocked-on-resume');
      expect(JSON.stringify(llm.getRequests()[1]?.body.messages)).not.toContain('executed-on-resume');
    });
  }

  if (engine === 'durable' || engine === 'evented' || engine === 'inngest') {
    it('keeps the first call delegation callbacks when a warm resume supplies only hooks', async () => {
      const llm = getMock();
      const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
      const worker = new Agent({
        id: 'worker',
        name: 'worker',
        description: 'Does delegated work',
        instructions: 'You do delegated work.',
        model: openai(SCENARIO_MODEL_ID),
      });
      const execute = vi.fn(async (_input: { key: string }, context) => {
        if (!context?.agent?.resumeData) return context?.agent?.suspend({ waiting: true });
        return { value: 'executed-on-resume' };
      });
      const tool = createTool({
        id: 'guarded_tool',
        description: 'A tool suspended before resuming.',
        inputSchema: z.object({ key: z.string() }),
        suspendSchema: z.object({ waiting: z.boolean() }),
        resumeSchema: z.object({ approved: z.boolean() }),
        execute,
      });
      const onDelegationStart = vi.fn(() => ({ proceed: true }));
      const onDelegationComplete = vi.fn();
      const resumeBefore = vi.fn();
      const isSupervisor = (req: any) => (req.tools ?? []).some((t: any) => t.function?.name === 'agent-worker');
      const lastToolCallId = (req: any) => {
        const last = req.messages.at(-1);
        return last?.role === 'tool' ? last.tool_call_id : undefined;
      };
      const shared = await createSharedAgent(llm, { engine, tools: { guarded_tool: tool }, agents: { worker } });
      const { output, chunks } = await runLoopScenario({
        engine,
        llm,
        sharedAgent: shared,
        prompt: 'Call the guarded tool, then delegate.',
        collectChunks: true,
        delegation: { onDelegationStart, onDelegationComplete },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', predicate: req => isSupervisor(req) && !lastToolCallId(req) },
            { toolCalls: [{ id: 'call_guarded', name: 'guarded_tool', arguments: { key: 'alpha' } }] },
          );
          llm.on(
            { endpoint: 'chat', predicate: req => isSupervisor(req) && lastToolCallId(req) === 'call_guarded' },
            { toolCalls: [{ id: 'call_worker', name: 'agent-worker', arguments: { prompt: 'do the task' } }] },
          );
          llm.on({ endpoint: 'chat', predicate: req => !isSupervisor(req) }, { content: 'sub done' });
          llm.on(
            { endpoint: 'chat', predicate: req => isSupervisor(req) && lastToolCallId(req) === 'call_worker' },
            { content: 'All done.' },
          );
        },
      });
      expect(chunks?.some(chunk => chunk.type === 'tool-call-suspended')).toBe(true);
      expect(onDelegationStart).not.toHaveBeenCalled();

      const resumed = await shared.agent.resumeStream(
        { approved: true },
        { runId: output.runId, hooks: { beforeToolCall: resumeBefore } },
      );
      for await (const _chunk of resumed.fullStream) {
        /* drain */
      }

      expect(execute).toHaveBeenCalledTimes(2);
      expect(resumeBefore).toHaveBeenCalledWith(expect.objectContaining({ toolName: 'guarded_tool' }));
      expect(onDelegationStart).toHaveBeenCalledTimes(1);
      expect(onDelegationComplete).toHaveBeenCalledTimes(1);
      expect(onDelegationComplete).toHaveBeenCalledWith(
        expect.objectContaining({ result: expect.objectContaining({ text: 'sub done' }) }),
      );
    });
  }

  if (engine === 'durable' || engine === 'evented' || engine === 'inngest') {
    const suspendingTool = (id: string, onExecute: () => void = () => {}) =>
      createTool({
        id,
        description: `${id} suspends before resuming.`,
        inputSchema: z.object({ key: z.string() }),
        suspendSchema: z.object({ waiting: z.boolean() }),
        resumeSchema: z.object({ approved: z.boolean() }),
        execute: async (_input, context) => {
          onExecute();
          if (!context?.agent?.resumeData) return context?.agent?.suspend({ waiting: true });
          return { value: `${id} resumed` };
        },
      });
    const drain = async (stream: { fullStream: AsyncIterable<unknown> }) => {
      for await (const _chunk of stream.fullStream) {
        /* drain */
      }
    };

    it('applies resume hooks to a tool from the toolsets passed on resume', async () => {
      const llm = getMock();
      const resumeBefore = vi.fn();
      const toolsets = { extra: { guarded_tool: suspendingTool('guarded_tool') } };
      const shared = await createSharedAgent(llm, { engine });
      const { output, chunks } = await runLoopScenario({
        engine,
        llm,
        sharedAgent: shared,
        prompt: 'Call the guarded tool.',
        toolsets,
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_guarded', name: 'guarded_tool', arguments: { key: 'alpha' } }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
        },
      });
      expect(chunks?.some(chunk => chunk.type === 'tool-call-suspended')).toBe(true);

      await drain(
        await shared.agent.resumeStream(
          { approved: true },
          { runId: output.runId, toolsets, hooks: { beforeToolCall: resumeBefore } },
        ),
      );

      expect(resumeBefore).toHaveBeenCalledWith(expect.objectContaining({ toolName: 'guarded_tool' }));
    });

    it('applies resume hooks to the memory tools of the suspended thread', async () => {
      const llm = getMock();
      const memory = new MockMemory({ enableWorkingMemory: true, workingMemoryTemplate: '# Notes\n- **Fact**:\n' });
      const threadId = 'hooks-resume-thread';
      const resourceId = 'hooks-resume-resource';
      await memory.createThread({ threadId, resourceId });
      const resumeBefore = vi.fn();
      const shared = await createSharedAgent(llm, {
        engine,
        tools: { guarded_tool: suspendingTool('guarded_tool') },
        memory,
      });
      const { output, chunks } = await runLoopScenario({
        engine,
        llm,
        sharedAgent: shared,
        prompt: 'Call the guarded tool, then save a note.',
        memory,
        threadId,
        resourceId,
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_guarded', name: 'guarded_tool', arguments: { key: 'alpha' } }] },
          );
          llm.on(
            { endpoint: 'chat', toolCallId: 'call_guarded', hasToolResult: true },
            {
              toolCalls: [
                { id: 'call_wm', name: 'updateWorkingMemory', arguments: { memory: '# Notes\n- **Fact**: x\n' } },
              ],
            },
          );
          llm.on({ endpoint: 'chat', toolCallId: 'call_wm', hasToolResult: true }, { content: 'Saved.' });
        },
      });
      expect(chunks?.some(chunk => chunk.type === 'tool-call-suspended')).toBe(true);

      await drain(
        await shared.agent.resumeStream(
          { approved: true },
          { runId: output.runId, hooks: { beforeToolCall: resumeBefore } },
        ),
      );

      expect(resumeBefore).toHaveBeenCalledWith(expect.objectContaining({ toolName: 'updateWorkingMemory' }));
    });

    it('runs a processor-added tool with the request context passed alongside resume hooks', async () => {
      const llm = getMock();
      const seen: unknown[] = [];
      const resumeBefore = vi.fn();
      const whoami = createTool({
        id: 'whoami',
        description: 'Reports the caller after resuming.',
        inputSchema: z.object({ key: z.string() }),
        suspendSchema: z.object({ waiting: z.boolean() }),
        resumeSchema: z.object({ approved: z.boolean() }),
        execute: async (_input, context) => {
          if (!context?.agent?.resumeData) return context?.agent?.suspend({ waiting: true });
          seen.push(context?.requestContext?.get('who'));
          return { value: 'whoami resumed' };
        },
      });
      const addTool: Processor = {
        id: 'add-whoami',
        processInputStep: ({ tools }) => ({ tools: { ...(tools ?? {}), whoami } }),
      };
      const shared = await createSharedAgent(llm, { engine, inputProcessors: [addTool] });
      const { output, chunks } = await runLoopScenario({
        engine,
        llm,
        sharedAgent: shared,
        prompt: 'Who am I?',
        requestContext: new RequestContext([['who', 'first']]),
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_who', name: 'whoami', arguments: { key: 'a' } }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
        },
      });
      expect(chunks?.some(chunk => chunk.type === 'tool-call-suspended')).toBe(true);

      await drain(
        await shared.agent.resumeStream(
          { approved: true },
          {
            runId: output.runId,
            requestContext: new RequestContext([['who', 'second']]),
            hooks: { beforeToolCall: resumeBefore },
          },
        ),
      );

      expect(seen).toEqual(['second']);
    });

    it('refreshes a tool on a later resume that an earlier resume did not rebuild', async () => {
      const llm = getMock();
      const firstResume = vi.fn();
      const secondResume = vi.fn();
      const toolB = suspendingTool('tool_b');
      const shared = await createSharedAgent(llm, { engine, tools: { tool_a: suspendingTool('tool_a') } });
      const { output, chunks } = await runLoopScenario({
        engine,
        llm,
        sharedAgent: shared,
        prompt: 'Call tool_a, then tool_b.',
        toolsets: { extra: { tool_b: toolB } },
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_a', name: 'tool_a', arguments: { key: 'a' } }] },
          );
          llm.on(
            { endpoint: 'chat', toolCallId: 'call_a', hasToolResult: true },
            { toolCalls: [{ id: 'call_b', name: 'tool_b', arguments: { key: 'b' } }] },
          );
          llm.on({ endpoint: 'chat', toolCallId: 'call_b', hasToolResult: true }, { content: 'Done.' });
        },
      });
      expect(chunks?.some(chunk => chunk.type === 'tool-call-suspended')).toBe(true);

      // The first resume omits the toolsets, so tool_b keeps its first-call build.
      await drain(
        await shared.agent.resumeStream(
          { approved: true },
          { runId: output.runId, hooks: { beforeToolCall: firstResume } },
        ),
      );
      expect(firstResume).toHaveBeenCalledWith(expect.objectContaining({ toolName: 'tool_a' }));

      await drain(
        await shared.agent.resumeStream(
          { approved: true },
          { runId: output.runId, toolsets: { extra: { tool_b: toolB } }, hooks: { beforeToolCall: secondResume } },
        ),
      );

      expect(secondResume).toHaveBeenCalledWith(expect.objectContaining({ toolName: 'tool_b' }));
      expect(JSON.stringify(llm.getRequests().at(-1)?.body.messages)).toContain('tool_b resumed');
    });
  }

  it('feeds the per-execution hook result back to the model through the assembled agent', async () => {
    const execute = vi.fn(async () => ({ value: 'unprotected-result' }));
    const beforeToolCall = vi.fn(() => ({ proceed: false as const, output: { value: 'protected-result' } }));
    const guardedTool = createTool({
      id: 'guarded_tool',
      description: 'A tool protected by an execution hook.',
      inputSchema: z.object({ key: z.string() }),
      execute,
    });

    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Use the guarded tool.',
      tools: { guarded_tool: guardedTool },
      defaultOptions: { hooks: { beforeToolCall } },
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_guarded', name: 'guarded_tool', arguments: { key: 'secret' } }] },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call_guarded', hasToolResult: true }, { content: 'Done.' });
      },
    });

    expect(requests).toHaveLength(2);
    expect(beforeToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'guarded_tool', input: { key: 'secret' } }),
    );
    expect(execute).not.toHaveBeenCalled();
    expect(JSON.stringify(requests[1]!.body.messages)).toContain('protected-result');
    expect(JSON.stringify(requests[1]!.body.messages)).not.toContain('unprotected-result');
  });

  it('short-circuits execute from defaultOptions.hooks.beforeToolCall alone', async () => {
    const beforeToolCall = vi.fn(() => ({ proceed: false as const, output: { value: 'blocked-by-default' } }));
    const execute = vi.fn(async () => ({ value: 'executed' }));
    const guardedTool = createTool({
      id: 'guarded_tool',
      description: 'A tool a hook can block.',
      inputSchema: z.object({ key: z.string() }),
      execute,
    });
    const llm = getMock();

    const { output, requests } = await runLoopScenario({
      engine,
      llm,
      prompt: 'Run the guarded tool.',
      stopWhen: stepCountIs(5),
      sharedAgent: buildHookedAgent(llm, {
        tools: { guarded_tool: guardedTool },
        executionHooks: { beforeToolCall },
      }),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_default', name: 'guarded_tool', arguments: { key: 'gamma' } }] },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call_default', hasToolResult: true }, { content: 'Blocked.' });
      },
    });

    expect(await output.text).toContain('Blocked');
    expect(execute).not.toHaveBeenCalled();
    expect(beforeToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'guarded_tool', input: { key: 'gamma' } }),
    );
    expect(JSON.stringify(requests[1]!.body.messages)).toContain('blocked-by-default');
  });

  it('lets per-execution afterToolCall override the agent hook and receive the tool output', async () => {
    const agentAfterToolCall = vi.fn();
    const runAfterToolCall = vi.fn();
    const execute = vi.fn(async ({ query }: { query: string }) => ({ answer: `real:${query}` }));
    const tracedTool = createTool({
      id: 'traced_tool',
      description: 'A tool observed by afterToolCall hooks.',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ answer: z.string() }),
      execute,
    });
    const llm = getMock();

    const { output, requests } = await runLoopScenario({
      engine,
      llm,
      prompt: 'Call the traced tool.',
      stopWhen: stepCountIs(5),
      sharedAgent: buildHookedAgent(llm, {
        tools: { traced_tool: tracedTool },
        hooks: { afterToolCall: agentAfterToolCall },
        executionHooks: { afterToolCall: runAfterToolCall },
      }),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_traced', name: 'traced_tool', arguments: { query: 'hi' } }] },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call_traced', hasToolResult: true }, { content: 'Got real:hi.' });
      },
    });

    expect(await output.text).toContain('real:hi');
    expect(requests).toHaveLength(2);
    expect(agentAfterToolCall).not.toHaveBeenCalled();
    expect(runAfterToolCall).toHaveBeenCalledTimes(1);
    expect(runAfterToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'traced_tool', output: { answer: 'real:hi' } }),
    );
  });

  it('runs afterToolCall with the error when the tool throws', async () => {
    const afterToolCall = vi.fn();
    const failingTool = createTool({
      id: 'failing_tool',
      description: 'A tool that always throws.',
      inputSchema: z.object({}),
      execute: async () => {
        throw new Error('TOOL_BOOM');
      },
    });
    const llm = getMock();

    const { output, requests } = await runLoopScenario({
      engine,
      llm,
      prompt: 'Call the failing tool.',
      stopWhen: stepCountIs(5),
      sharedAgent: buildHookedAgent(llm, {
        tools: { failing_tool: failingTool },
        hooks: { afterToolCall },
      }),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_failing', name: 'failing_tool', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call_failing', hasToolResult: true }, { content: 'The tool failed.' });
      },
    });

    expect(await output.text).toContain('failed');
    expect(requests).toHaveLength(2);
    expect(afterToolCall).toHaveBeenCalledTimes(1);
    expect(afterToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'failing_tool',
        input: {},
        output: undefined,
        error: expect.objectContaining({ message: expect.stringContaining('TOOL_BOOM') }),
      }),
    );
  });
});

let hookedAgentCounter = 0;

/**
 * The harness has no `hooks` option, so build the AIMock-backed agent here and hand it to
 * `runLoopScenario` as a `sharedAgent` (the harness wraps it for durable/evented engines).
 * `hooks` sets agent-level hooks; `executionHooks` sets per-execution hooks via `defaultOptions`.
 */
function buildHookedAgent(
  llm: LLMock,
  { tools, hooks, executionHooks }: { tools: ToolsInput; hooks?: ToolHooks; executionHooks?: ToolHooks },
): { agent: Agent; mastra: Mastra } {
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
  const id = `tool-hooks-scenario-agent-${++hookedAgentCounter}`;
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
