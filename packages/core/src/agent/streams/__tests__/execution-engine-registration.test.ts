import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { ConsoleLogger } from '../../../logger';
import { Mastra } from '../../../mastra';
import { RequestContext } from '../../../request-context';
import { Agent } from '../../agent';
import type { AgentDurableOption } from '../../types';
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
