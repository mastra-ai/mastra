import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { ConsoleLogger } from '../../../logger';
import { Mastra } from '../../../mastra';
import { RequestContext } from '../../../request-context';
import { Agent } from '../../agent';
import { createDurableAgent, createEventedAgent, DurableAgent, EventedAgent } from '../../durable';
import { isDurableAgentLike } from '../../types';
import type { AgentDurableOption } from '../../types';
import { hasDurableExecution } from '../execution-capability';
import type { ExecutionEngine } from '../execution-engine';

const config = { id: 'policy', name: 'Policy', instructions: 'Help the user.', model: 'openai/gpt-4o' } as const;
const inputs = [
  undefined,
  true,
  {},
  { cleanupTimeoutMs: 0 },
  { executionEngine: 'durable' },
  { executionEngine: 'evented' },
  { executionEngine: false },
  false,
] satisfies (AgentDurableOption | undefined)[];

afterEach(() => vi.restoreAllMocks());

describe('native Agent stored-registration policy', () => {
  for (const executionEngine of [undefined, false, 'durable', 'evented'] satisfies (ExecutionEngine | undefined)[]) {
    for (const registration of ['constructor', 'addAgent'] as const) {
      it.each(inputs)(`${registration} preserves explicit policy %j with host ${String(executionEngine)}`, durable => {
        const agent = new Agent({ ...config, durable });
        const mastra = new Mastra({
          durable: { executionEngine, cleanupTimeoutMs: 99 },
          ...(registration === 'constructor' ? { agents: { policy: agent } } : {}),
        });
        if (registration === 'addAgent') mastra.addAgent(agent);
        const explicit = typeof durable === 'object' ? durable.executionEngine : undefined;
        expect(agent.__getExecutionEnginePolicy()).toBe(
          durable === false ? false : (explicit ?? executionEngine ?? false),
        );
        expect(mastra.getAgentById('policy')).toBe(agent);
        expect(agent.hasResumableStreams()).toBe(durable !== false);
      });
    }
  }

  it('inherits individual missing fields without replacing explicit transport, false, zero or callbacks', () => {
    const pubsub = new EventEmitterPubSub();
    const shouldCache = () => false;
    const shouldPersistSnapshot = () => true;
    const agent = new Agent({ ...config, durable: { pubsub, cache: false, cleanupTimeoutMs: 0, shouldCache } });
    const mastra = new Mastra({
      durable: { executionEngine: 'evented', cleanupTimeoutMs: 999, shouldCache: () => true, shouldPersistSnapshot },
    });
    mastra.addAgent(agent);
    expect(agent.durable).toEqual({
      executionEngine: 'evented',
      pubsub,
      cache: false,
      cleanupTimeoutMs: 0,
      shouldCache,
      shouldPersistSnapshot,
    });
    expect(agent.getPubSub()).toBe(mastra.pubsub);
    new Mastra({
      agents: { policy: agent },
      durable: { executionEngine: 'durable', cleanupTimeoutMs: 888, shouldPersistSnapshot: () => false },
    });
    expect(agent.durable).toEqual({
      executionEngine: 'evented',
      pubsub,
      cache: false,
      cleanupTimeoutMs: 0,
      shouldCache,
      shouldPersistSnapshot,
    });
  });

  it('does not turn propagated sub-agent hosts into stored registration', async () => {
    const child = new Agent({ ...config, id: 'child' });
    const parent = new Agent({ ...config, agents: { child } });
    const mastra = new Mastra({ agents: { parent }, durable: { executionEngine: 'evented' } });
    expect(await parent.listAgents()).toEqual({ child });
    expect(child.getMastraInstance()).toBe(mastra);
    expect(child.__getExecutionEnginePolicy()).toBe(false);
    expect(child.durable).toBeUndefined();
    mastra.addAgent(child);
    expect(child.__getExecutionEnginePolicy()).toBe('evented');
  });

  it.each(inputs)('preserves the original configuration shape without host defaults: %j', durable => {
    const agent = new Agent({ ...config, durable });
    new Mastra({ agents: { policy: agent } });
    expect(agent.durable).toEqual(durable);
  });

  it('host attachment and inspection do not inherit or lock the engine', () => {
    const mastra = new Mastra({ durable: { executionEngine: 'evented' } });
    const agent = new Agent({ ...config, mastra });
    expect(agent.__getExecutionEnginePolicy()).toBe(false);
    agent.__registerMastra(mastra);
    expect(agent.__getExecutionEnginePolicy()).toBe(false);
    mastra.addAgent(agent);
    expect(agent.__getExecutionEnginePolicy()).toBe('evented');
  });

  it.each(['stream', 'generate'] as const)(
    'a %s rejected during synchronous message processing leaves selection provisional',
    async method => {
      const agent = new Agent(config);
      const messages = [{ role: 'tool' as const, content: [] }];
      Object.defineProperty(messages[0], 'content', {
        get() {
          throw new Error('Unreadable caller messages');
        },
      });
      await expect(agent[method](messages, {})).rejects.toThrow('Unreadable caller messages');
      new Mastra({ agents: { policy: agent }, durable: { executionEngine: 'evented' } });
      expect(agent.__getExecutionEnginePolicy()).toBe('evented');
    },
  );

  it.each(['stream', 'generate'] as const)(
    'a rejected first %s still fixes the engine before asynchronous validation',
    async method => {
      const agent = new Agent({ ...config, requestContextSchema: z.object({ token: z.string() }) });
      await expect(agent[method]('hello', { requestContext: new RequestContext<{ token: string }>() })).rejects.toThrow(
        'Request context validation failed',
      );
      const warn = vi.spyOn(ConsoleLogger.prototype, 'warn');
      new Mastra({ agents: { policy: agent }, durable: { executionEngine: 'evented' } });
      expect(agent.__getExecutionEnginePolicy()).toBe(false);
      expect(
        warn.mock.calls.filter(([message]) => String(message).includes('fixed for this Agent instance')),
      ).toHaveLength(1);
    },
  );

  it.each(['durable', 'evented'] as const)(
    'warns only for explicitly incompatible static defaults inherited from %s',
    executionEngine => {
      const warn = vi.spyOn(ConsoleLogger.prototype, 'warn');
      const agent = new Agent({ ...config, defaultOptions: { eagerToolExecution: true, stopWhen: () => true } });
      const host = new Mastra({ durable: { executionEngine } });
      host.addAgent(agent);
      host.addAgent(agent);
      const messages = warn.mock.calls.map(([message]) => String(message));
      expect(messages.filter(message => message.includes('does not support eagerToolExecution'))).toHaveLength(1);
      expect(messages.filter(message => message.includes('does not support stopWhen'))).toHaveLength(
        executionEngine === 'evented' ? 1 : 0,
      );
      expect(messages.every(message => message.includes('activation is deferred'))).toBe(true);
    },
  );

  it.each([undefined, false, 'durable', 'evented'] satisfies (ExecutionEngine | undefined)[])(
    'does not warn for explicit policy %s or implicit eager defaults',
    executionEngine => {
      const warn = vi.spyOn(ConsoleLogger.prototype, 'warn');
      new Mastra({
        agents: { policy: new Agent({ ...config, durable: { executionEngine } }) },
        durable: { executionEngine: 'evented' },
      });
      new Mastra({ agents: { policy: new Agent(config) }, durable: { executionEngine: 'durable' } });
      expect(warn).not.toHaveBeenCalled();
    },
  );

  it.each([false, 'durable', 'evented'] as const)(
    'does not diagnose incompatible defaults or caller closures for explicit policy %s',
    async executionEngine => {
      const agent = new Agent({
        ...config,
        durable: { executionEngine },
        defaultOptions: { eagerToolExecution: true, stopWhen: () => true },
        requestContextSchema: z.object({ token: z.string() }),
      });
      const warn = vi.spyOn(ConsoleLogger.prototype, 'warn');
      new Mastra({ agents: { policy: agent }, durable: { executionEngine: 'evented' } });
      const requestContext = new RequestContext();
      requestContext.set('closure', () => {});
      await expect(agent.stream('hello', { requestContext })).rejects.toThrow('Request context validation failed');
      expect(
        warn.mock.calls.filter(([message]) => String(message).includes('Native execution activation is deferred')),
      ).toHaveLength(0);
    },
  );

  it('does not diagnose JSON-safe caller context for inherited policy', async () => {
    const agent = new Agent({ ...config, requestContextSchema: z.object({ token: z.string() }) });
    const warn = vi.spyOn(ConsoleLogger.prototype, 'warn');
    new Mastra({ agents: { policy: agent }, durable: { executionEngine: 'durable' } });
    const requestContext = new RequestContext();
    requestContext.set('order', { id: 4821, tags: ['shipped'] });
    await expect(agent.generate('hello', { requestContext })).rejects.toThrow('Request context validation failed');
    expect(
      warn.mock.calls.filter(([message]) => String(message).includes('Native execution activation is deferred')),
    ).toHaveLength(0);
  });

  it('inspects caller context only on invocation and deduplicates unsupported-value diagnostics', async () => {
    const agent = new Agent({ ...config, requestContextSchema: z.object({ token: z.string() }) });
    const warn = vi.spyOn(ConsoleLogger.prototype, 'warn');
    new Mastra({ agents: { policy: agent }, durable: { executionEngine: 'durable' } });
    const requestContext = new RequestContext();
    requestContext.set('closure', () => {});
    expect(warn).not.toHaveBeenCalled();
    for (const method of ['stream', 'generate'] as const) {
      await expect(agent[method]('hello', { requestContext })).rejects.toThrow('Request context validation failed');
    }
    expect(
      warn.mock.calls.filter(([message]) => String(message).includes('non-JSON caller request context')),
    ).toHaveLength(1);
  });
});

// COR-1563: wrapping an independently registered Agent must not leave inherited execution policy behind.
describe('wrapper ownership overrides the whole inner durable field', () => {
  it('does not restore wrapper-owned defaults from a non-engine host', () => {
    const inner = new Agent(config);
    createDurableAgent({ agent: inner });
    const warn = vi.spyOn(ConsoleLogger.prototype, 'warn');
    new Mastra({ agents: { inner }, durable: { cleanupTimeoutMs: 999 } });
    expect(inner.durable).toEqual({ executionEngine: false });
    expect(warn.mock.calls.filter(([message]) => String(message).includes('Native execution activation'))).toHaveLength(
      0,
    );
  });

  it.each(['unrelated', 'throwing'] as const)('preserves legacy capability with a %s strategy property', kind => {
    const inner = new Agent(config);
    const wrapped = createDurableAgent({ agent: inner });
    const legacy = {
      id: wrapped.id,
      name: wrapped.name,
      agent: inner,
      stream: wrapped.stream.bind(wrapped),
      recover: wrapped.recover.bind(wrapped),
      recoverActiveRuns: wrapped.recoverActiveRuns.bind(wrapped),
    };
    Object.defineProperty(legacy, '__getExecutionEngineStrategy', {
      get() {
        if (kind === 'throwing') throw new Error('Not a core strategy protocol');
        return () => 'third-party';
      },
    });
    expect(isDurableAgentLike(legacy)).toBe(true);
    expect(hasDurableExecution(legacy)).toBe(true);
  });

  const wrappers = [
    { name: 'DurableAgent', engine: 'durable', wrap: (agent: Agent) => new DurableAgent({ agent }) },
    { name: 'EventedAgent', engine: 'evented', wrap: (agent: Agent) => new EventedAgent({ agent }) },
    { name: 'createDurableAgent', engine: 'durable', wrap: (agent: Agent) => createDurableAgent({ agent }) },
    { name: 'createEventedAgent', engine: 'evented', wrap: (agent: Agent) => createEventedAgent({ agent }) },
  ] as const;
  for (const wrapper of wrappers) {
    for (const executionEngine of ['durable', 'evented'] as const) {
      for (const registerFirst of [false, true]) {
        for (const resolveBus of [false, true]) {
          it.each(inputs)(
            `${wrapper.name}/${executionEngine}/registered=${registerFirst}/bus=${resolveBus}: isolates %j`,
            durable => {
              const agent = new Agent({ ...config, durable });
              const shouldCache = () => false;
              const shouldPersistSnapshot = () => false;
              const mastra = new Mastra({
                durable: { executionEngine, shouldCache, cleanupTimeoutMs: 0, shouldPersistSnapshot },
              });
              if (registerFirst) mastra.addAgent(agent);
              const bus = resolveBus ? agent.__getStreamBus() : undefined;
              const transport = bus?.pubsub;
              const cache = bus?.cache;
              const capturedConfig = bus?.forkConfig;
              const warn = vi.spyOn(ConsoleLogger.prototype, 'warn');
              const wrapped = wrapper.wrap(agent);
              expect(warn).not.toHaveBeenCalled();
              expect(agent.durable).toEqual({ executionEngine: false });
              expect(agent.__getExecutionEnginePolicy()).toBe(false);
              expect(wrapped.__getExecutionEngineStrategy()).toBe(wrapper.engine);
              expect(hasDurableExecution(wrapped)).toBe(true);
              expect(isDurableAgentLike(wrapped)).toBe(true);
              expect(hasDurableExecution(agent)).toBe(false);
              if (bus) {
                expect(agent.__getStreamBus()).toBe(bus);
                expect(bus.pubsub).toBe(transport);
                expect(bus.cache).toBe(cache);
                expect(bus.forkConfig).toEqual(capturedConfig);
              }
              // A distinct host avoids the existing duplicate-key restriction for replacing a plain registration.
              const wrapperHost = new Mastra({ agents: { wrapped }, durable: { executionEngine } });
              expect(wrapperHost.getAgent('wrapped')).toBe(wrapped);
              for (let attempt = 0; attempt < 2; attempt++) mastra.addAgent(agent);
              expect(agent.durable).toEqual({ executionEngine: false });
              expect(wrapped.__getExecutionEngineStrategy()).toBe(wrapper.engine);
              expect(
                warn.mock.calls.filter(([message]) =>
                  String(message).includes('Wrapper-owned inner Agent stays plain'),
                ),
              ).toHaveLength(1);
              warn.mockRestore();
            },
          );
        }
      }
    }
  }

  it.each([false, true])('discards explicit durable transport without reconfiguring an existing bus=%s', resolveBus => {
    const durableBus = new EventEmitterPubSub();
    const topLevelBus = new EventEmitterPubSub();
    const wrapperBus = new EventEmitterPubSub();
    const shouldCache = () => false;
    const shouldPersistSnapshot = () => true;
    const agent = new Agent({
      ...config,
      pubsub: topLevelBus,
      durable: {
        executionEngine: 'evented',
        pubsub: durableBus,
        cache: false,
        cleanupTimeoutMs: 0,
        shouldCache,
        shouldPersistSnapshot,
      },
    });
    const bus = resolveBus ? agent.__getStreamBus() : undefined;
    const transport = bus?.pubsub;
    const wrapped = createDurableAgent({
      agent,
      pubsub: wrapperBus,
      cache: false,
      cleanupTimeoutMs: 0,
      shouldCache,
      shouldPersistSnapshot,
    });
    expect(agent.durable).toEqual({ executionEngine: false });
    expect(agent.getPubSub()).toBe(topLevelBus);
    expect(wrapped.__getStreamBus()?.pubsub).toBe(wrapperBus);
    const futureBus = agent.__getStreamBus();
    if (bus) {
      expect(futureBus).toBe(bus);
      expect(futureBus?.pubsub).toBe(transport);
      expect(futureBus?.cache).toBeNull();
      expect(futureBus?.forkConfig).toMatchObject({
        pubsub: durableBus,
        cache: false,
        cleanupTimeoutMs: 0,
        shouldCache,
      });
    } else {
      expect(futureBus?.forkConfig.pubsub).toBe(topLevelBus);
      expect(futureBus?.forkConfig.cache).toBeUndefined();
      expect(futureBus?.forkConfig.shouldCache).toBeUndefined();
      expect(futureBus?.forkConfig.cleanupTimeoutMs).toBe(30_000);
    }
  });

  it('retains forced evented strategy before host/storage fallback and isolates wrapped forks', () => {
    const agent = new Agent({ ...config, durable: { executionEngine: 'durable' } });
    const wrapped = createEventedAgent({ agent });
    expect(wrapped.__getExecutionEngineStrategy()).toBe('evented');
    const fork = wrapped.__fork();
    expect(fork).toBeInstanceOf(EventedAgent);
    if (!(fork instanceof EventedAgent)) throw new Error('Expected an evented wrapper fork');
    expect(fork.__getExecutionEngineStrategy()).toBe('evented');
    expect(fork.agent.durable).toEqual({ executionEngine: false });
    expect(agent.durable).toEqual({ executionEngine: false });
  });
});
