import { Readable, Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runAcpServer } from './server.js';

const state = vi.hoisted(() => ({
  dispose: vi.fn(),
  closed: Promise.resolve(),
  onConstruct: () => {},
}));
vi.mock('./agent.js', () => ({
  MastraCodeAcpAgent: class {
    dispose = state.dispose;
  },
}));
vi.mock('@agentclientprotocol/sdk', () => ({
  ndJsonStream: vi.fn(),
  AgentSideConnection: class {
    closed = state.closed;
    constructor(factory: (connection: unknown) => unknown) {
      state.onConstruct();
      factory({});
    }
  },
}));

beforeEach(() => {
  state.dispose.mockReset();
  state.onConstruct = () => {};
  vi.spyOn(Readable, 'toWeb').mockReturnValue(new ReadableStream());
  vi.spyOn(Writable, 'toWeb').mockReturnValue(new WritableStream());
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
});
afterEach(() => vi.restoreAllMocks());

describe('ACP server shutdown', () => {
  it('waits for cleanup once when multiple signals arrive', async () => {
    const closed = Promise.withResolvers<void>();
    const cleanup = Promise.withResolvers<void>();
    state.closed = closed.promise;
    state.dispose.mockReturnValue(cleanup.promise);
    const server = runAcpServer(vi.fn());
    try {
      process.emit('SIGINT', 'SIGINT');
      process.emit('SIGTERM', 'SIGTERM');
      await Promise.resolve();
      expect(state.dispose).toHaveBeenCalledTimes(1);
      expect(process.exit).not.toHaveBeenCalled();
      cleanup.resolve();
      await vi.waitFor(() => expect(process.exit).toHaveBeenCalledExactlyOnceWith(0));
    } finally {
      cleanup.resolve();
      closed.resolve();
      await server;
    }
  });

  it('keeps signal handling installed while EOF cleanup is pending', async () => {
    const closed = Promise.withResolvers<void>();
    const cleanup = Promise.withResolvers<void>();
    state.closed = closed.promise;
    state.dispose.mockReturnValue(cleanup.promise);
    const initialListeners = process.listenerCount('SIGTERM');
    const server = runAcpServer(vi.fn());
    try {
      closed.resolve();
      await vi.waitFor(() => expect(state.dispose).toHaveBeenCalledOnce());
      expect(process.listenerCount('SIGTERM')).toBe(initialListeners + 1);
      process.emit('SIGTERM', 'SIGTERM');
      expect(process.exit).not.toHaveBeenCalled();
      cleanup.resolve();
      await server;
      await vi.waitFor(() => expect(process.exit).toHaveBeenCalledExactlyOnceWith(0));
      expect(process.listenerCount('SIGTERM')).toBe(initialListeners);
    } finally {
      cleanup.resolve();
      await server;
    }
  });

  it('exits when a signal arrives before the agent is assigned', async () => {
    state.closed = Promise.resolve();
    state.dispose.mockResolvedValue(undefined);
    state.onConstruct = () => {
      process.emit('SIGTERM', 'SIGTERM');
    };
    await runAcpServer(vi.fn());
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalledWith(0));
  });
});
