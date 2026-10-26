import { describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from './index';

describe('Mastra.setServer()', () => {
  it('rejects invalid heartbeat configuration before subscribing background tasks', async () => {
    const pubsub = new EventEmitterPubSub();
    const subscribe = vi.spyOn(pubsub, 'subscribe');
    try {
      expect(
        () =>
          new Mastra({
            logger: false,
            pubsub,
            backgroundTasks: { enabled: true },
            workers: false,
            server: { agentSseHeartbeatMs: -1 },
          }),
      ).toThrow('agentSseHeartbeatMs');
      await Promise.resolve();
      expect(subscribe).not.toHaveBeenCalled();
    } finally {
      await pubsub.close();
    }
  });
  it.each([0, 25_000, 2_147_483_647])('accepts agent SSE heartbeat interval %s', agentSseHeartbeatMs => {
    const mastra = new Mastra({ logger: false, server: { agentSseHeartbeatMs } });
    expect(mastra.getServer()?.agentSseHeartbeatMs).toBe(agentSseHeartbeatMs);
    mastra.setServer({ agentSseHeartbeatMs });
    expect(mastra.getServer()?.agentSseHeartbeatMs).toBe(agentSseHeartbeatMs);
  });

  it.each([-1, NaN, Infinity, 0.5, 2_147_483_648])(
    'rejects invalid agent SSE heartbeat interval %s',
    agentSseHeartbeatMs => {
      expect(() => new Mastra({ logger: false, server: { agentSseHeartbeatMs } })).toThrow('agentSseHeartbeatMs');
      const mastra = new Mastra({ logger: false, server: { port: 4111 } });
      expect(() => mastra.setServer({ agentSseHeartbeatMs })).toThrow('agentSseHeartbeatMs');
      expect(mastra.getServer()).toEqual({ port: 4111 });
    },
  );

  it('should set server config on a Mastra instance with no initial server', () => {
    const mastra = new Mastra({ logger: false });

    expect(mastra.getServer()).toBeUndefined();

    const serverConfig = { port: 3000 };
    mastra.setServer(serverConfig as any);

    expect(mastra.getServer()).toEqual(serverConfig);
  });

  it('should replace existing server config', () => {
    const initialConfig = { port: 3000 };
    const mastra = new Mastra({ logger: false, server: initialConfig as any });

    expect(mastra.getServer()).toEqual(initialConfig);

    const updatedConfig = { port: 4000 };
    mastra.setServer(updatedConfig as any);

    expect(mastra.getServer()).toEqual(updatedConfig);
  });

  it('should allow merging with existing server config via spread', () => {
    const initialConfig = { port: 3000, timeout: 5000 };
    const mastra = new Mastra({ logger: false, server: initialConfig as any });

    mastra.setServer({ ...mastra.getServer(), port: 8080 } as any);

    expect(mastra.getServer()).toEqual({ port: 8080, timeout: 5000 });
  });
});
