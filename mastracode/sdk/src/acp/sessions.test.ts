import type { AgentSideConnection } from '@agentclientprotocol/sdk';
import type { AgentController, AgentControllerEvent, Session } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';
import { MastraCodeAcpAgent } from './agent.js';

function runtime(id: string) {
  let listener: (event: AgentControllerEvent) => void = () => {};
  const mode = { get: () => 'build', switch: vi.fn().mockResolvedValue(undefined) };
  const model = { get: () => 'test-model', switch: vi.fn().mockResolvedValue(undefined) };
  const sendMessage = vi.fn().mockResolvedValue(undefined);
  const abort = vi.fn(() => listener({ type: 'agent_end', reason: 'aborted' }));
  const cleanup = vi.fn().mockResolvedValue(undefined);
  const unsubscribe = vi.fn();
  const session = {
    subscribe: (callback: typeof listener) => {
      listener = callback;
      return unsubscribe;
    },
    thread: { create: async () => ({ id }), switch: vi.fn().mockResolvedValue(undefined) },
    mode,
    model,
    sendMessage,
    abort,
  } as unknown as Session;
  return {
    controller: {
      listAvailableModels: async () => [{ id: 'test-model', modelName: 'Test', hasApiKey: true }],
    } as unknown as AgentController,
    session,
    modes: [{ id: 'build' }, { id: 'plan' }],
    cleanup,
    sendMessage,
    abort,
    mode,
    model,
    unsubscribe,
    emit: (event: AgentControllerEvent) => listener(event),
  };
}

const connection = () => ({ sessionUpdate: vi.fn().mockResolvedValue(undefined) }) as unknown as AgentSideConnection;

describe('ACP session isolation', () => {
  it.each(['factory', 'model discovery'])(
    'bounds shutdown during stalled %s and cleans up a late runtime',
    async phase => {
      vi.useFakeTimers();
      const state = runtime('late');
      const entered = Promise.withResolvers<void>();
      const startup = Promise.withResolvers<void>();
      const block = async () => {
        entered.resolve();
        await startup.promise;
      };
      if (phase === 'model discovery')
        state.controller.listAvailableModels = async () => {
          await block();
          return [];
        };
      const agent = new MastraCodeAcpAgent(connection(), async () => {
        if (phase === 'factory') await block();
        return state;
      });
      const creating = agent.newSession({ cwd: '/one', mcpServers: [] });
      const rejected = expect(creating).rejects.toMatchObject({ code: -32603 });
      try {
        await entered.promise;
        const disposal = agent.dispose();
        expect(agent.dispose()).toBe(disposal);
        const timedOut = expect(disposal).rejects.toThrow('ACP shutdown timed out');
        await vi.advanceTimersByTimeAsync(10_000);
        await timedOut;
        expect(state.cleanup).not.toHaveBeenCalled();
        startup.resolve();
        await rejected;
        expect(state.cleanup).toHaveBeenCalledOnce();
      } finally {
        startup.resolve();
        await rejected;
        vi.useRealTimers();
      }
    },
  );

  it('reports cleanup failures from a session that was still starting at shutdown', async () => {
    const state = runtime('starting');
    const startup = Promise.withResolvers<typeof state>();
    const entered = Promise.withResolvers<void>();
    const failure = new Error('Startup cleanup failed');
    state.cleanup.mockRejectedValueOnce(failure);
    const agent = new MastraCodeAcpAgent(connection(), () => {
      entered.resolve();
      return startup.promise;
    });
    const creating = agent.newSession({ cwd: '/one', mcpServers: [] });
    const rejected = expect(creating).rejects.toBe(failure);
    await entered.promise;
    const disposal = agent.dispose();
    const failed = expect(disposal).rejects.toMatchObject({ errors: [failure] });
    startup.resolve(state);
    await Promise.all([rejected, failed]);
  });

  it.each(['factory', 'model discovery'])(
    'waits for a session still starting during %s before disposing',
    async phase => {
      const state = runtime('starting');
      const entered = Promise.withResolvers<void>();
      const startup = Promise.withResolvers<void>();
      const cleanup = Promise.withResolvers<void>();
      state.cleanup.mockReturnValueOnce(cleanup.promise);
      const block = async () => {
        entered.resolve();
        await startup.promise;
      };
      if (phase === 'model discovery')
        state.controller.listAvailableModels = async () => {
          await block();
          return [];
        };
      const agent = new MastraCodeAcpAgent(connection(), async () => {
        if (phase === 'factory') await block();
        return state;
      });
      const creating = agent.newSession({ cwd: '/one', mcpServers: [] });
      const rejected = expect(creating).rejects.toMatchObject({ code: -32603 });
      await entered.promise;
      const settled = vi.fn();
      const a = agent.dispose().then(settled);
      const b = agent.dispose().then(settled);
      try {
        await new Promise<void>(resolve => setImmediate(resolve));
        expect(settled).not.toHaveBeenCalled();
        startup.resolve();
        await vi.waitFor(() => expect(state.cleanup).toHaveBeenCalledOnce());
        expect(settled).not.toHaveBeenCalled();
      } finally {
        startup.resolve();
        cleanup.resolve();
        await Promise.all([a, b, rejected]);
      }
      expect(settled).toHaveBeenCalledTimes(2);
    },
  );

  it('makes concurrent disposal callers wait for every session cleanup', async () => {
    const first = runtime('first');
    const second = runtime('second');
    const release = Promise.withResolvers<void>();
    first.cleanup.mockRejectedValueOnce(new Error('First cleanup failed'));
    second.cleanup.mockReturnValueOnce(release.promise);
    const factory = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const agent = new MastraCodeAcpAgent(connection(), factory);
    await agent.newSession({ cwd: '/one', mcpServers: [] });
    await agent.newSession({ cwd: '/two', mcpServers: [] });
    const settled = vi.fn();
    const a = agent.dispose().then(settled, settled);
    const b = agent.dispose().then(settled, settled);
    try {
      await new Promise<void>(resolve => setImmediate(resolve));
      expect(settled).not.toHaveBeenCalled();
    } finally {
      release.resolve();
      await Promise.all([a, b]);
    }
    expect(first.cleanup).toHaveBeenCalledOnce();
    expect(second.cleanup).toHaveBeenCalledOnce();
    expect(settled).toHaveBeenCalledTimes(2);
  });

  it('creates an independent runtime from each requested working directory and MCP configuration', async () => {
    const first = runtime('first');
    const second = runtime('second');
    const factory = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const agent = new MastraCodeAcpAgent(connection(), factory);
    const request = { cwd: '/one', mcpServers: [{ name: 'test-server', command: '/test-server', args: [], env: [] }] };
    expect(await agent.newSession(request)).toMatchObject({ sessionId: 'first' });
    const firstPrompt = agent.prompt({ sessionId: 'first', prompt: [] });
    await vi.waitFor(() => expect(first.sendMessage).toHaveBeenCalledTimes(1));
    expect(await agent.newSession({ cwd: '/two', mcpServers: [] })).toMatchObject({ sessionId: 'second' });
    expect(factory).toHaveBeenNthCalledWith(1, request);
    const secondPrompt = agent.prompt({ sessionId: 'second', prompt: [] });
    await vi.waitFor(() => expect(second.sendMessage).toHaveBeenCalledTimes(1));
    await agent.cancel({ sessionId: 'second' });
    expect(first.abort).not.toHaveBeenCalled();
    await expect(secondPrompt).resolves.toMatchObject({ stopReason: 'cancelled' });
    first.emit({ type: 'agent_end', reason: 'complete' });
    await expect(firstPrompt).resolves.toMatchObject({ stopReason: 'end_turn' });
    await agent.dispose();
    expect(first.cleanup).toHaveBeenCalledTimes(1);
    expect(second.cleanup).toHaveBeenCalledTimes(1);
    expect(first.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('serializes mode and model changes after the active turn using persistent switch methods', async () => {
    const state = runtime('first');
    const agent = new MastraCodeAcpAgent(connection(), async () => state);
    await agent.newSession({ cwd: '/one', mcpServers: [] });
    const prompt = agent.prompt({ sessionId: 'first', prompt: [] });
    await vi.waitFor(() => expect(state.sendMessage).toHaveBeenCalledTimes(1));
    const mode = agent.setSessionMode({ sessionId: 'first', modeId: 'plan' });
    const model = agent.unstable_setSessionModel({ sessionId: 'first', modelId: 'test-model' });
    await Promise.resolve();
    expect(state.mode.switch).not.toHaveBeenCalled();
    state.emit({ type: 'agent_end', reason: 'complete' });
    await Promise.all([prompt, mode, model]);
    expect(state.mode.switch).toHaveBeenCalledWith({ modeId: 'plan' });
    expect(state.model.switch).toHaveBeenCalledWith({ modelId: 'test-model' });
    await agent.dispose();
  });

  it('cancels queued prompts without sending their messages', async () => {
    const state = runtime('first');
    const agent = new MastraCodeAcpAgent(connection(), async () => state);
    await agent.newSession({ cwd: '/one', mcpServers: [] });
    const first = agent.prompt({ sessionId: 'first', prompt: [] });
    await vi.waitFor(() => expect(state.sendMessage).toHaveBeenCalledTimes(1));
    const queued = agent.prompt({ sessionId: 'first', prompt: [] });
    await agent.cancel({ sessionId: 'first' });
    await expect(first).resolves.toMatchObject({ stopReason: 'cancelled' });
    await expect(queued).resolves.toMatchObject({ stopReason: 'cancelled' });
    expect(state.sendMessage).toHaveBeenCalledTimes(1);
    await agent.dispose();
  });

  it('settles cancellation after a tool suspension even when abort emits no further events', async () => {
    const state = runtime('first');
    state.abort.mockImplementation(() => {});
    const detach = vi.fn();
    Object.assign(state.session, { stream: { detach } });
    const agent = new MastraCodeAcpAgent(connection(), async () => state);
    await agent.newSession({ cwd: '/one', mcpServers: [] });
    const prompt = agent.prompt({ sessionId: 'first', prompt: [] });
    await vi.waitFor(() => expect(state.sendMessage).toHaveBeenCalled());
    state.emit({ type: 'agent_end', reason: 'suspended' });
    await agent.cancel({ sessionId: 'first' });
    await expect(prompt).resolves.toMatchObject({ stopReason: 'cancelled' });
    expect(detach).toHaveBeenCalledTimes(1);
    await agent.dispose();
  });

  it('rejects unknown sessions and invalid modes before mutating a session', async () => {
    const state = runtime('first');
    const agent = new MastraCodeAcpAgent(connection(), async () => state);
    await agent.newSession({ cwd: '/one', mcpServers: [] });
    await expect(agent.prompt({ sessionId: 'missing', prompt: [] })).rejects.toMatchObject({ code: -32602 });
    await expect(agent.setSessionMode({ sessionId: 'first', modeId: 'missing' })).rejects.toMatchObject({
      code: -32602,
    });
    expect(state.mode.switch).not.toHaveBeenCalled();
    await agent.dispose();
  });
});
