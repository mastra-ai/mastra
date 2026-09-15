import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '../../agent';
import { Session } from '../../agent-controller/session';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { RequestContext } from '../../request-context';
import { createTool, ToolPolicyError } from '../../tools';
import { MockMemory } from '../../memory/mock';
import { globalRunRegistry } from '../../agent/durable/run-registry';
import { createDurableToolCallStep } from '../../agent/durable/workflows/steps/tool-call';
import { resolveRuntimeDependencies, rebuildRunToolsFromMastra } from '../../agent/durable/utils/resolve-runtime';
import { DurableStepIds } from '../../agent/durable/constants';
import { ToolSearchProcessor } from './tool-search';
import { SkillSearchProcessor } from './skill-search';
import { MessageList } from '../../agent/message-list';
import { executeToolWithPolicy } from '../../tools/tool-policy-execution';
import { createToolSkillPolicy } from './tool-skill-dependencies';

function callingModel(toolName: string, input: unknown, remaining: Array<[string, unknown]> = []) {
  const sequence: Array<[string, unknown]> = [[toolName, input], ...remaining];
  let step = 0;
  const next = () => {
    const call = sequence[step++];
    if (!call) return undefined;
    return {
      type: 'tool-call' as const,
      toolCallId: step === 1 ? 'call' : `call-${step}`,
      toolName: call[0],
      input: JSON.stringify(call[1]),
    };
  };
  return new MockLanguageModelV2({
    doGenerate: async () => {
      const call = next();
      return {
        content: call ? [call] : [{ type: 'text', text: 'Done' }],
        finishReason: call ? 'tool-calls' : 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      };
    },
    doStream: async () => {
      const call = next();
      return {
        stream: convertArrayToReadableStream([
          ...(call
            ? [call]
            : [
                { type: 'text-start' as const, id: 'done' },
                { type: 'text-delta' as const, id: 'done', delta: 'Done' },
                { type: 'text-end' as const, id: 'done' },
              ]),
          {
            type: 'finish',
            finishReason: call ? 'tool-calls' : 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          },
        ]),
      };
    },
  });
}

it('carries native readiness through a reconstructed execution context', async () => {
  const context = new RequestContext();
  context.set('user', 'owner');
  const skills = {
    listNames: async () => ['required'],
    get: async () => ({ name: 'required', instructions: 'Required instructions' }),
    maybeRefresh: async () => {},
  };
  const skillSearch = new SkillSearchProcessor({ workspace: { skills } as any, trackReadiness: true, ttl: 0 });
  const args = { requestContext: context, messageList: new MessageList({}), messages: [], stepNumber: 0 } as any;
  const first = await skillSearch.processInputStep(args);
  await (first.tools as any).load_skill.execute({ skillName: 'required' });
  await skillSearch.processInputStep(args);
  const policy = createToolSkillPolicy({ protected_tool: ['required'] });
  const execute = vi.fn(async () => ({ created: true }));
  const transform = vi.fn((input: { amount: string }) => ({ amount: Number(input.amount) + 1 }));
  const tool = createTool({
    id: 'protected_tool',
    description: 'Protected',
    inputSchema: z.object({ amount: z.string() }).transform(transform),
    execute,
  });
  const search = new ToolSearchProcessor({ tools: { protected_tool: tool }, toolPolicy: policy, ttl: 0 });
  const meta = await search.processInputStep(args);
  await (meta.tools as any).load_tool.execute({ toolName: 'protected_tool' });
  const loaded = (await search.processInputStep(args)).tools.protected_tool;
  const converter = new Agent({
    id: 'context-converter',
    name: 'Context converter',
    instructions: 'Convert',
    model: callingModel('none', {}),
    tools: { protected_tool: loaded },
  });
  const converted = (await converter.getToolsForExecution({ requestContext: context })).protected_tool!;
  const result = await executeToolWithPolicy(
    converted,
    'protected_tool',
    { amount: '4' },
    {
      requestContext: new RequestContext(context.entries()),
      toolCallId: 'context-call',
      messages: [],
    },
    policy,
    context,
  );
  expect(result).toEqual({ created: true });
  expect(execute).toHaveBeenCalledTimes(1);
  expect(transform).toHaveBeenCalledTimes(1);
  expect(execute).toHaveBeenCalledWith({ amount: 5 }, expect.anything());
  skillSearch.dispose();
});

describe.each([false, true])('accepted-input policy (durable=%s)', durable => {
  it.each(['default', 'transform'])('checks the %s accepted by the executor, not raw model arguments', async kind => {
    const execute = vi.fn(async () => ({ created: true }));
    const transform = vi.fn(() => ({ type: 'mini_app' }));
    const inputSchema =
      kind === 'default' ? z.object({ type: z.string().default('mini_app') }) : z.object({}).transform(transform);
    const tool = createTool({ id: 'create_artifact', description: 'Create artifact', inputSchema, execute });
    const policy = createToolSkillPolicy({
      create_artifact: ({ phase, input }) =>
        phase === 'execute' && (input as any)?.type === 'mini_app' ? ['mini-app-builder'] : [],
    });
    const agent = new Agent({
      id: `accepted-${kind}-${durable}`,
      name: 'Accepted input',
      instructions: 'Use tools',
      model: callingModel('create_artifact', {}),
      durable,
      tools: { create_artifact: tool },
      toolPolicy: policy,
      inputProcessors: [new ToolSearchProcessor({ tools: {}, toolPolicy: policy, ttl: 0 })],
    });
    const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false });
    const result = await mastra
      .getAgent('agent')
      .generate('Create', { requestContext: new RequestContext(), maxSteps: 2 });
    expect(execute).not.toHaveBeenCalled();
    expect(JSON.stringify(result.toolResults)).toContain('MISSING_REQUIRED_SKILL');
    if (kind === 'transform') expect(transform).toHaveBeenCalledTimes(1);
  });

  it.each(['mastra', 'converted', 'core', 'alias'])('checks a later processor injecting a %s tool', async kind => {
    const execute = vi.fn(async () => ({ created: true }));
    const source = createTool({
      id: kind === 'alias' ? 'internal_image' : 'generate_image',
      description: 'Generate image',
      inputSchema: z.object({}),
      execute,
    });
    let tool: any = source;
    if (kind === 'converted') {
      const converter = new Agent({
        id: 'converter',
        name: 'Converter',
        instructions: 'Convert',
        model: callingModel('none', {}),
        tools: { generate_image: source },
      });
      tool = (await converter.getToolsForExecution({ requestContext: new RequestContext() })).generate_image;
    } else if (kind === 'core') {
      tool = { description: 'Generate image', parameters: z.object({}), execute };
    }
    const policy = createToolSkillPolicy({
      generate_image: ({ phase }) => (phase === 'execute' ? ['image-generation'] : []),
    });
    const agent = new Agent({
      id: `injected-${kind}-${durable}`,
      name: 'Injected tool',
      instructions: 'Use tools',
      model: callingModel(kind === 'alias' ? 'internal_image' : 'generate_image', {}),
      durable,
      toolPolicy: policy,
      inputProcessors: [
        new ToolSearchProcessor({ tools: {}, toolPolicy: policy, ttl: 0 }),
        {
          id: 'late-tools',
          processInputStep: async args => ({ tools: { ...args.tools, generate_image: tool } }),
        },
      ],
    });
    const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false });
    const result = await mastra
      .getAgent('agent')
      .generate('Create', { requestContext: new RequestContext(), maxSteps: 2 });
    expect(execute).not.toHaveBeenCalled();
    expect(JSON.stringify(result.toolResults)).toContain('MISSING_REQUIRED_SKILL');
  });

  it.each(['provider', 'client', 'server'])('filters a late protected %s tool before the model call', async kind => {
    const seen: string[][] = [];
    const model = new MockLanguageModelV2({
      doStream: async options => {
        seen.push((options.tools ?? []).map(tool => tool.name));
        return {
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: 'done' },
            { type: 'text-delta', id: 'done', delta: 'Done' },
            { type: 'text-end', id: 'done' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        };
      },
    });
    const protectedTool =
      kind === 'provider'
        ? { type: 'provider-defined', id: 'openai.web_search', args: {} }
        : {
            description: 'Protected',
            parameters: z.object({}),
            ...(kind === 'server' ? { execute: async () => ({}) } : {}),
          };
    const plainTool = { description: 'Plain', parameters: z.object({}) };
    const agent = new Agent({
      id: `late-active-${kind}-${durable}`,
      name: 'Late active',
      instructions: 'Use tools',
      model,
      durable,
      toolPolicy: createToolSkillPolicy({ protected_tool: ['required'] }),
      inputProcessors: [
        {
          id: 'late-active',
          processInputStep: async args => ({
            tools: { ...args.tools, protected_tool: protectedTool, plain_tool: plainTool } as any,
          }),
        },
      ],
    });
    const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false });
    const result = await mastra.getAgent('agent').stream('Run', { maxSteps: 1 });
    for await (const _chunk of result.fullStream) {
      /* consume native execution */
    }
    expect(seen).toHaveLength(1);
    expect(seen[0]).not.toContain('protected_tool');
    expect(seen[0]).toContain('plain_tool');
  });

  it('keeps an unprotected transform single-pass', async () => {
    const transform = vi.fn((value: { amount: string }) => ({ amount: Number(value.amount) + 1 }));
    const execute = vi.fn(async input => input);
    const tool = createTool({
      id: 'plain',
      description: 'Plain',
      inputSchema: z.object({ amount: z.string() }).transform(transform),
      execute,
    });
    const agent = new Agent({
      id: `plain-${durable}`,
      name: 'Plain',
      instructions: 'Use tools',
      model: callingModel('plain', { amount: '4' }),
      durable,
      tools: { plain: tool },
      toolPolicy: createToolSkillPolicy({ generate_image: ['image-generation'] }),
    });
    const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false });
    await mastra.getAgent('agent').generate('Plain', { maxSteps: 2 });
    expect(transform).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith({ amount: 5 }, expect.anything());
  });
});

describe.each([false, true])('resumed policy (cold=%s)', cold => {
  it.each(['approval', 'suspension'])(
    'rechecks accepted input after %s',
    async kind => {
      const storage = new InMemoryStore();
      const memoryStore = new InMemoryStore();
      const memory = { thread: `policy-${kind}-${cold}`, resource: 'policy-owner' };
      const transform = vi.fn((input: { amount: string }) => ({ amount: Number(input.amount) + 1 }));
      let allow = true;
      const execute = vi.fn(async (_input, context) => {
        if (kind === 'suspension' && !context.agent?.resumeData) {
          return context.agent.suspend({ waiting: true });
        }
        return { created: true };
      });
      const policy = createToolSkillPolicy({
        protected_tool: ({ phase, input }) =>
          phase === 'execute' && !allow && (input as any)?.amount === 5 ? ['required-skill'] : [],
      });
      const model = callingModel('protected_tool', { amount: '4' });
      const build = () => {
        const tool = createTool({
          id: 'protected_tool',
          description: 'Protected operation',
          inputSchema: z.object({ amount: z.string() }).transform(transform),
          requireApproval: kind === 'approval',
          suspendSchema: z.object({ waiting: z.boolean() }),
          resumeSchema: z.object({ continue: z.boolean() }),
          execute,
        });
        const agent = new Agent({
          id: 'resumed-policy',
          name: 'Resumed policy',
          instructions: 'Use tools',
          model,
          durable: true,
          tools: { protected_tool: tool },
          toolPolicy: policy,
          memory: new MockMemory({ storage: memoryStore }),
        });
        const mastra = new Mastra({ agents: { agent }, storage, logger: false });
        return mastra.getAgent('agent');
      };
      let agent = build();
      const started = await agent.stream('Run', { memory, maxSteps: 3 });
      const suspendedType = kind === 'approval' ? 'tool-call-approval' : 'tool-call-suspended';
      let suspended = false;
      for await (const chunk of started.fullStream) {
        if (chunk.type === suspendedType) {
          suspended = true;
          break;
        }
      }
      expect(suspended).toBe(true);
      const workflows = (await storage.getStore('workflows'))!;
      await vi.waitFor(async () => {
        const saved = await workflows.getWorkflowRunById({
          runId: started.runId,
          workflowName: DurableStepIds.AGENTIC_LOOP,
        });
        const snapshot = typeof saved?.snapshot === 'string' ? JSON.parse(saved.snapshot) : saved?.snapshot;
        expect(snapshot?.status).toBe('suspended');
      });
      const callsBeforeResume = execute.mock.calls.length;
      allow = false;
      if (cold) {
        globalRunRegistry.clear();
        agent = build();
      }
      if (kind === 'suspension') {
        await expect(
          agent.resumeStream({ continue: true }, { runId: started.runId, toolCallId: 'call', memory }),
        ).rejects.toMatchObject({ code: 'MISSING_REQUIRED_SKILL', missingSkills: ['required-skill'], retryable: true });
        const saved = await workflows.getWorkflowRunById({
          runId: started.runId,
          workflowName: DurableStepIds.AGENTIC_LOOP,
        });
        const snapshot = typeof saved?.snapshot === 'string' ? JSON.parse(saved.snapshot) : saved?.snapshot;
        expect(snapshot?.status).toBe('suspended');
        expect(execute).toHaveBeenCalledTimes(callsBeforeResume);
        allow = true;
        const retry = await agent.resumeStream(
          { continue: true },
          { runId: started.runId, toolCallId: 'call', memory },
        );
        const output = [];
        for await (const chunk of retry.fullStream) output.push(chunk);
        expect(JSON.stringify(output)).toContain('"created":true');
        expect(execute).toHaveBeenCalledTimes(callsBeforeResume + 1);
        expect(execute.mock.calls.at(-1)?.[0]).toEqual({ amount: 5 });
        expect(transform).toHaveBeenCalledTimes(1);
        return;
      }
      const resumed =
        kind === 'approval'
          ? await agent.approveToolCall({ runId: started.runId, toolCallId: 'call', memory })
          : await agent.resumeStream({ continue: true }, { runId: started.runId, toolCallId: 'call', memory });
      const chunks = [];
      for await (const chunk of resumed.fullStream) chunks.push(chunk);
      expect(execute).toHaveBeenCalledTimes(callsBeforeResume);
      expect(JSON.stringify(chunks)).toContain('MISSING_REQUIRED_SKILL');
      expect(transform).toHaveBeenCalledTimes(1);
    },
    15000,
  );
});

describe.each([false, true])('global prepared policy (durable=%s)', durable => {
  it.each([false, true])('gates native discovery without processor-local policy (autoLoad=%s)', async autoLoad => {
    const execute = vi.fn(async () => ({}));
    const resolver = vi.fn(async () => createToolSkillPolicy({ protected_tool: ['required'] }));
    const tool = createTool({
      id: 'protected_tool',
      description: 'protected_tool operation',
      inputSchema: z.object({}),
      execute,
    });
    const agent = new Agent({
      id: 'global-load',
      name: 'Global load',
      instructions: 'Use tools',
      durable,
      model: callingModel(
        autoLoad ? 'search_tools' : 'load_tool',
        autoLoad ? { query: 'protected_tool' } : { toolName: 'protected_tool' },
      ),
      inputProcessors: [
        new SkillSearchProcessor({
          workspace: {
            skills: {
              listNames: async () => ['required'],
              get: async () => ({ name: 'required', instructions: 'Required' }),
              maybeRefresh: async () => {},
            },
          } as any,
          trackReadiness: true,
          ttl: 0,
        }),
        new ToolSearchProcessor({ tools: { protected_tool: tool }, storage: 'context', search: { autoLoad }, ttl: 0 }),
      ],
    });
    const mastra = new Mastra({
      agents: { agent },
      toolPolicy: { resolve: resolver },
      storage: new InMemoryStore(),
      logger: false,
    });
    const result = await mastra.getAgent('agent').generate('Load', { maxSteps: 2 });
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
    expect(JSON.stringify(result.toolResults)).toContain('MISSING_REQUIRED_SKILL');
  });

  it('refreshes once each preparation and cannot be relaxed by an agent', async () => {
    const execute = vi.fn(async () => ({}));
    const resolver = vi.fn(async () =>
      createToolSkillPolicy({ protected_tool: ({ phase }) => (phase === 'execute' ? ['required'] : []) }),
    );
    const tool = createTool({ id: 'protected_tool', description: 'Protected', inputSchema: z.object({}), execute });
    const agent = new Agent({
      id: 'global-direct',
      name: 'Global direct',
      instructions: 'Use tools',
      durable,
      model: callingModel('protected_tool', {}),
      tools: { protected_tool: tool },
      toolPolicy: () => ({ allowed: true }),
    });
    const mastra = new Mastra({
      agents: { agent },
      toolPolicy: { resolve: resolver },
      storage: new InMemoryStore(),
      logger: false,
    });
    const context = new RequestContext();
    const result = await mastra.getAgent('agent').generate('Run', { requestContext: context, maxSteps: 2 });
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result.toolResults)).toContain('MISSING_REQUIRED_SKILL');
    await mastra.getAgent('agent').generate('Again', { requestContext: context, maxSteps: 1 });
    expect(resolver).toHaveBeenCalledTimes(2);
    expect(execute).not.toHaveBeenCalled();
  });
});

it('enforces global policy on direct registered tools and resolves once per call', async () => {
  const execute = vi.fn(async () => ({}));
  const resolver = vi.fn(async () => createToolSkillPolicy({ registered: ['required'] }));
  const raw = createTool({ id: 'internal', description: 'Protected', inputSchema: z.object({}), execute });
  const mastra = new Mastra({ tools: { registered: raw }, toolPolicy: { resolve: resolver }, logger: false });
  const result = await mastra.getTool('registered').execute!({}, { requestContext: new RequestContext() });
  expect(result).toMatchObject({ code: 'MISSING_REQUIRED_SKILL', tool: 'registered' });
  expect(resolver).toHaveBeenCalledTimes(1);
  expect(execute).not.toHaveBeenCalled();
  const plain = new Mastra({ tools: { registered: raw }, logger: false });
  await plain.getTool('registered').execute!({}, { requestContext: new RequestContext() });
  expect(execute).toHaveBeenCalledTimes(1);
});

it('keeps a shared discovery processor isolated between concurrent prepared policies', async () => {
  const tool = createTool({
    id: 'protected_tool',
    description: 'Protected',
    inputSchema: z.object({}),
    execute: async () => ({}),
  });
  const processor = new ToolSearchProcessor({ tools: { protected_tool: tool }, ttl: 0 });
  const build = (id: string) =>
    new Agent({
      id,
      name: id,
      instructions: 'Load',
      model: callingModel('load_tool', { toolName: 'protected_tool' }),
      inputProcessors: [processor],
    });
  const resolver = vi.fn(async ({ agentId }) =>
    createToolSkillPolicy(agentId === 'blocked' ? { protected_tool: ['required'] } : {}),
  );
  const mastra = new Mastra({
    agents: { blocked: build('blocked'), allowed: build('allowed') },
    toolPolicy: { resolve: resolver },
    logger: false,
  });
  const [blocked, allowed] = await Promise.all([
    mastra.getAgent('blocked').generate('Load', { maxSteps: 1 }),
    mastra.getAgent('allowed').generate('Load', { maxSteps: 1 }),
  ]);
  expect(JSON.stringify(blocked.toolResults)).toContain('MISSING_REQUIRED_SKILL');
  expect(JSON.stringify(allowed.toolResults)).toContain('"success":true');
  expect(resolver).toHaveBeenCalledTimes(2);
});

it('fails closed before durable model execution when policy resolution fails', async () => {
  const execute = vi.fn(async () => ({}));
  const agent = new Agent({
    id: 'failed-policy',
    name: 'Failed',
    instructions: 'Use tools',
    durable: true,
    model: callingModel('protected_tool', {}),
    inputProcessors: [
      {
        id: 'late',
        processInputStep: async () => ({ tools: { protected_tool: { parameters: z.object({}), execute } } }),
      },
    ],
  });
  const mastra = new Mastra({
    agents: { agent },
    toolPolicy: {
      resolve: async () => {
        throw new Error('POLICY_STORE_DOWN');
      },
    },
    storage: new InMemoryStore(),
    logger: false,
  });
  await expect(mastra.getAgent('agent').generate('Run')).rejects.toThrow('Tool policy is unavailable.');
  expect(execute).not.toHaveBeenCalled();
});

it('protects a late registered child without inheriting the parent skill readiness', async () => {
  const execute = vi.fn(async () => ({}));
  const child = new Agent({
    id: 'child',
    name: 'Child',
    instructions: 'Use protected tool',
    model: callingModel('protected_tool', {}),
    tools: {
      protected_tool: createTool({
        id: 'protected_tool',
        description: 'Protected',
        inputSchema: z.object({}),
        execute,
      }),
    },
    toolPolicy: () => ({ allowed: true }),
  });
  const skills = {
    listNames: async () => ['required'],
    get: async () => ({ name: 'required', instructions: 'Parent instruction' }),
    maybeRefresh: async () => {},
  };
  const skillSearch = new SkillSearchProcessor({ workspace: { skills } as any, trackReadiness: true, ttl: 0 });
  const parent = new Agent({
    id: 'parent',
    name: 'Parent',
    instructions: 'Load then delegate',
    model: callingModel('load_skill', { skillName: 'required' }, [['agent-child', { prompt: 'Run protected tool' }]]),
    agents: { child },
    inputProcessors: [skillSearch],
  });
  const resolver = vi.fn(async () => createToolSkillPolicy({ protected_tool: ['required'] }));
  const mastra = new Mastra({ toolPolicy: { resolve: resolver }, logger: false });
  mastra.addAgent(parent, 'parent');
  const result = await mastra.getAgent('parent').generate('Run', { maxSteps: 3 });
  expect(JSON.stringify(result.toolResults)).toContain('"success":true');
  expect(resolver.mock.calls.some(([args]) => args.agentId === 'child')).toBe(true);
  expect(execute).not.toHaveBeenCalled();
  skillSearch.dispose();
});

it('keeps the prepared loading policy immutable across composed processors', async () => {
  const tool = createTool({
    id: 'protected_tool',
    description: 'Protected',
    inputSchema: z.object({}),
    execute: async () => ({}),
  });
  const source = new Agent({
    id: 'immutable-policy',
    name: 'Immutable',
    instructions: 'Load tool',
    durable: true,
    model: callingModel('load_tool', { toolName: 'protected_tool' }),
    inputProcessors: [
      { id: 'attempt-override', processInputStep: async () => ({ toolPolicy: () => ({ allowed: true }) }) } as any,
      new ToolSearchProcessor({ tools: { protected_tool: tool }, storage: 'context', ttl: 0 }),
    ],
  });
  const mastra = new Mastra({
    agents: { source },
    storage: new InMemoryStore(),
    logger: false,
    toolPolicy: createToolSkillPolicy({ protected_tool: ['required'] }),
  });
  const result = await mastra.getAgent('source').generate('Load', { maxSteps: 2 });
  expect(JSON.stringify(result.toolResults)).toContain('MISSING_REQUIRED_SKILL');
  expect(JSON.stringify(result.toolResults)).not.toContain('already loaded');
});

it('preserves dependency details in the model transcript when a protected tool cannot be found', async () => {
  const model = callingModel('protected_tool', {});
  const source = new Agent({ id: 'missing-policy', name: 'Missing', instructions: 'Call tool', model, durable: true });
  const mastra = new Mastra({
    agents: { source },
    storage: new InMemoryStore(),
    logger: false,
    toolPolicy: createToolSkillPolicy({ protected_tool: ['required'] }),
  });
  const result = await mastra.getAgent('source').generate('Call', { maxSteps: 2 });
  const transcript = JSON.stringify(model.doStreamCalls);
  expect(transcript).toContain('MISSING_REQUIRED_SKILL');
  expect(transcript).toContain('missingSkills');
  expect(transcript).toContain('retryable');
  expect(JSON.stringify(result.steps)).toContain('MISSING_REQUIRED_SKILL');
});

it('fails closed when worker preparation cannot resolve the policy', async () => {
  const source = new Agent({
    id: 'failed-worker',
    name: 'Worker',
    instructions: 'Run',
    model: callingModel('none', {}),
  });
  const resolver = vi.fn(async () => {
    throw new Error('POLICY_STORE_DOWN');
  });
  const mastra = new Mastra({ agents: { source }, toolPolicy: { resolve: resolver }, logger: false });
  await expect(
    rebuildRunToolsFromMastra({ mastra, agentId: source.id, runId: 'failed-worker-run', state: {} as any }),
  ).rejects.toThrow('Tool policy is unavailable.');
  await expect(
    resolveRuntimeDependencies({
      mastra,
      agentId: source.id,
      runId: 'failed-worker-model',
      input: { state: {}, messageListState: new MessageList({}).serialize(), options: {}, modelConfig: {} } as any,
    }),
  ).rejects.toThrow('Tool policy is unavailable.');
  expect(resolver).toHaveBeenCalledTimes(2);
  expect(globalRunRegistry.has('failed-worker-run')).toBe(false);
  expect(globalRunRegistry.has('failed-worker-model')).toBe(false);
});

it('keeps the Session suspension and display when native dependency resume is blocked', async () => {
  const session = new Session({ id: 'policy-session', ownerId: 'owner', resourceId: 'owner' });
  const denied = new ToolPolicyError({ code: 'REQUIRED_SKILL_UNAVAILABLE', retryable: false });
  const sendStreamResume = vi.fn(async () => {
    throw denied;
  });
  const agent = { sendStreamResume };
  session.setMachinery({
    getRunScope: () => undefined,
    getAgent: () => agent,
    buildRequestContext: async () => new RequestContext(),
    buildSharedRunOptions: () => ({}),
    buildToolsets: async () => ({}),
  } as any);
  session.thread.set({ threadId: 'thread' });
  vi.spyOn(session.thread, 'ensureSubscription').mockResolvedValue(undefined as any);
  const finish = vi.spyOn(session, 'finishAgentRun').mockResolvedValue(undefined);
  session.suspensions.register({ toolCallId: 'call', runId: 'saved', toolName: 'protected_tool' });
  session.emit({
    type: 'tool_suspended',
    toolCallId: 'call',
    toolName: 'protected_tool',
    args: { amount: 5 },
    suspendPayload: { job: 'existing-job' },
    resumeSchema: {},
  } as any);
  await session.respondToToolSuspension({ toolCallId: 'call', resumeData: { continue: true } });
  expect(finish).not.toHaveBeenCalled();
  expect(session.suspensions.get({ toolCallId: 'call' })).toEqual({ runId: 'saved', toolName: 'protected_tool' });
  expect(session.displayState.get().pendingSuspensions.get('call')?.suspendPayload).toEqual({ job: 'existing-job' });
  await session.respondToToolSuspension({ toolCallId: 'call', resumeData: { continue: true } });
  expect(sendStreamResume).toHaveBeenCalledTimes(2);
  expect(sendStreamResume.mock.calls.every(([args]) => args.runId === 'saved')).toBe(true);
});

it.each(['manual', 'auto'] as const)(
  'keeps a missing unprotected tool an error under %s approval',
  async toolApprovalPolicy => {
    const suspend = vi.fn();
    const mastra = new Mastra({ logger: false });
    const output = await (createDurableToolCallStep() as any).execute({
      inputData: { toolCallId: 'missing', toolName: 'absent', args: {} },
      mastra,
      requestContext: new RequestContext(),
      suspend,
      getInitData: () => ({ runId: 'absent-run', agentId: 'absent-agent', options: { toolApprovalPolicy }, state: {} }),
    });
    expect(output.error.name).toBe('ToolNotFoundError');
    expect(suspend).not.toHaveBeenCalled();
  },
);

it('can decline a saved approval while policy storage is unavailable without executing it', async () => {
  const storage = new InMemoryStore();
  const memoryStore = new InMemoryStore();
  const memory = { thread: 'decline-policy', resource: 'owner' };
  const execute = vi.fn(async () => ({}));
  let unavailable = false;
  const resolver = vi.fn(async () => {
    if (unavailable) throw new Error('private store details');
    return createToolSkillPolicy({});
  });
  const build = () => {
    const source = new Agent({
      id: 'decline-policy',
      name: 'Decline',
      instructions: 'Use tool',
      durable: true,
      model: callingModel('protected_tool', {}),
      memory: new MockMemory({ storage: memoryStore }),
      tools: {
        protected_tool: createTool({
          id: 'protected_tool',
          description: 'Protected',
          inputSchema: z.object({}),
          requireApproval: true,
          execute,
        }),
      },
    });
    return new Mastra({ agents: { source }, storage, logger: false, toolPolicy: { resolve: resolver } }).getAgent(
      'source',
    );
  };
  const first = build();
  const started = await first.stream('Run', { memory, maxSteps: 2 });
  for await (const chunk of started.fullStream) if (chunk.type === 'tool-call-approval') break;
  const workflows = (await storage.getStore('workflows'))!;
  await vi.waitFor(async () => {
    const saved = await workflows.getWorkflowRunById({
      runId: started.runId,
      workflowName: DurableStepIds.AGENTIC_LOOP,
    });
    const snapshot = typeof saved?.snapshot === 'string' ? JSON.parse(saved.snapshot) : saved?.snapshot;
    expect(snapshot?.status).toBe('suspended');
  });
  globalRunRegistry.clear();
  unavailable = true;
  const resumed = await build().declineToolCall({ runId: started.runId, toolCallId: 'call', memory });
  const chunks = [];
  for await (const chunk of resumed.fullStream) chunks.push(chunk);
  expect(chunks.some(chunk => chunk.type === 'tool-output-denied')).toBe(true);
  expect(execute).not.toHaveBeenCalled();
  expect(JSON.stringify(chunks)).not.toContain('private store details');
});
