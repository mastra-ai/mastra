import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitterPubSub } from '../events/event-emitter';
import { BackgroundTaskManager } from './manager';
import type { ResultInjector, ToolResolver } from './types';

function createResolver(implementations: Record<string, (args: any, opts?: any) => Promise<any>>): ToolResolver {
  return (toolName: string) => {
    const impl = implementations[toolName];
    if (!impl) throw new Error(`Unknown tool: ${toolName}`);
    return { execute: impl };
  };
}

const tick = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));

describe('Result injection into message list', () => {
  const managers: BackgroundTaskManager[] = [];
  const pubsubs: EventEmitterPubSub[] = [];

  function create(config: ConstructorParameters<typeof BackgroundTaskManager>[0] = {}) {
    const ps = new EventEmitterPubSub();
    const mgr = new BackgroundTaskManager(config);
    pubsubs.push(ps);
    managers.push(mgr);
    return { pubsub: ps, manager: mgr };
  }

  afterEach(async () => {
    for (const m of managers) await m.shutdown().catch(() => {});
    for (const p of pubsubs) await p.close();
    managers.length = 0;
    pubsubs.length = 0;
  });

  it('calls resultInjector with completed result', async () => {
    const { pubsub, manager } = create();
    await manager.init(pubsub);

    const injector: ResultInjector = vi.fn();
    manager.setResultInjector(injector);
    manager.setToolResolver(createResolver({ tool: vi.fn().mockResolvedValue({ data: 'hello' }) }));

    await manager.enqueue({
      toolName: 'tool',
      toolCallId: 'call-1',
      args: { q: 'test' },
      agentId: 'agent-1',
      threadId: 'thread-1',
      resourceId: 'user-1',
    });

    await tick();

    expect(injector).toHaveBeenCalledTimes(1);
    expect(injector).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: 'call-1',
        toolName: 'tool',
        agentId: 'agent-1',
        threadId: 'thread-1',
        resourceId: 'user-1',
        result: { data: 'hello' },
        status: 'completed',
      }),
    );
  });

  it('calls resultInjector with failed result', async () => {
    const { pubsub, manager } = create();
    await manager.init(pubsub);

    const injector: ResultInjector = vi.fn();
    manager.setResultInjector(injector);
    manager.setToolResolver(createResolver({ tool: vi.fn().mockRejectedValue(new Error('broken')) }));

    await manager.enqueue({
      toolName: 'tool',
      toolCallId: 'call-1',
      args: {},
      agentId: 'agent-1',
    });

    await tick();

    expect(injector).toHaveBeenCalledTimes(1);
    expect(injector).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: 'call-1',
        toolName: 'tool',
        error: expect.objectContaining({ message: 'broken' }),
        status: 'failed',
      }),
    );
  });

  it('does not call resultInjector when messageHandling is "none"', async () => {
    const { pubsub, manager } = create({ messageHandling: 'none' });
    await manager.init(pubsub);

    const injector: ResultInjector = vi.fn();
    manager.setResultInjector(injector);
    manager.setToolResolver(createResolver({ tool: vi.fn().mockResolvedValue('ok') }));

    await manager.enqueue({
      toolName: 'tool',
      toolCallId: 'call-1',
      args: {},
      agentId: 'agent-1',
    });

    await tick();

    expect(injector).not.toHaveBeenCalled();
  });

  it('still streams chunks even when messageHandling is "none"', async () => {
    const { pubsub, manager } = create({ messageHandling: 'none' });
    await manager.init(pubsub);

    const chunkEmitter = vi.fn();
    manager.setStreamChunkEmitter(chunkEmitter);
    manager.setToolResolver(createResolver({ tool: vi.fn().mockResolvedValue('ok') }));

    await manager.enqueue({
      toolName: 'tool',
      toolCallId: 'call-1',
      args: {},
      agentId: 'agent-1',
    });

    await tick();

    expect(chunkEmitter).toHaveBeenCalledWith(
      'agent-1',
      expect.objectContaining({ type: 'background-task-completed' }),
    );
  });

  it('calls resultInjector by default (final-only)', async () => {
    const { pubsub, manager } = create(); // default messageHandling = 'final-only'
    await manager.init(pubsub);

    const injector: ResultInjector = vi.fn();
    manager.setResultInjector(injector);
    manager.setToolResolver(createResolver({ tool: vi.fn().mockResolvedValue('done') }));

    await manager.enqueue({
      toolName: 'tool',
      toolCallId: 'call-1',
      args: {},
      agentId: 'agent-1',
    });

    await tick();

    expect(injector).toHaveBeenCalledTimes(1);
  });
});
