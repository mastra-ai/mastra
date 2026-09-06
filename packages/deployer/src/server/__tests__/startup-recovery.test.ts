import type { Server } from 'node:http';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNodeServer } from '../index';

describe('production startup durable-agent recovery', () => {
  let mastra: Mastra;
  let server: Server | undefined;
  let listeners: Map<NodeJS.Signals, Function[]>;

  beforeEach(() => {
    vi.stubEnv('MASTRA_TELEMETRY_DISABLED', 'true');
    vi.stubEnv('MASTRA_HTTPS_KEY', '');
    vi.stubEnv('MASTRA_HTTPS_CERT', '');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No outbound requests are permitted'));
    listeners = new Map((['SIGINT', 'SIGTERM'] as const).map(signal => [signal, process.listeners(signal)]));
  });

  afterEach(async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise<void>(resolve => server!.close(() => resolve()));
      server = undefined;
    }
    await mastra?.shutdown();
    for (const [signal, previous] of listeners) {
      for (const listener of process.listeners(signal)) {
        if (!previous.includes(listener)) process.removeListener(signal, listener);
      }
    }
    expect(globalThis.fetch).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  function fixture(mode?: 'auto' | 'off') {
    const modelCall = vi.fn(async () => {
      throw new Error('No model execution is permitted');
    });
    const agent = createDurableAgent({
      agent: new Agent({
        id: 'startup-proof',
        name: 'Startup proof',
        instructions: 'No task is sent.',
        model: {
          specificationVersion: 'v2',
          provider: 'unpaid-fixture',
          modelId: 'never-run',
          supportedUrls: {},
          doGenerate: modelCall,
          doStream: modelCall,
        },
      }),
    });
    mastra = new Mastra({
      agents: { agent },
      storage: new InMemoryStore({ id: 'startup-proof' }),
      ...(mode ? { recovery: { durableAgents: mode } } : {}),
      logger: false,
      server: { host: '127.0.0.1', port: 0 },
    });
    return {
      modelCall,
      recovery: vi.spyOn(mastra, 'recoverAllDurableAgents'),
      agentRecovery: vi.spyOn(agent, 'recoverActiveRuns'),
      workers: vi.spyOn(mastra, 'startWorkers'),
    };
  }

  async function start(isDev = false) {
    server = (await createNodeServer(mastra, { tools: {}, studio: false, isDev })) as Server;
  }

  it.each(['auto', 'off', undefined] as const)('honors production recovery=%s with real native methods', async mode => {
    const proof = fixture(mode);
    await start();

    expect(proof.workers).toHaveBeenCalledOnce();
    if (mode === 'auto') {
      await vi.waitFor(() => expect(proof.agentRecovery).toHaveBeenCalledOnce());
      expect(proof.recovery).toHaveBeenCalledOnce();
      expect(proof.workers.mock.invocationCallOrder[0]).toBeLessThan(proof.recovery.mock.invocationCallOrder[0]!);
      await expect(proof.recovery.mock.results[0]!.value).resolves.toEqual({
        agents: 1,
        recovered: 0,
        succeeded: 0,
        failed: 0,
      });
    } else {
      expect(proof.recovery).not.toHaveBeenCalled();
      expect(proof.agentRecovery).not.toHaveBeenCalled();
    }
    expect(proof.modelCall).not.toHaveBeenCalled();
  });

  it('leaves dev recovery to its existing restart endpoint', async () => {
    const proof = fixture('auto');
    await start(true);
    expect(proof.recovery).not.toHaveBeenCalled();

    const app = mastra.getServerApp<{ request: (path: string, init: RequestInit) => Promise<Response> }>();
    const response = await app!.request('/__restart-active-workflow-runs', { method: 'POST' });
    expect(response.status).toBe(200);
    await vi.waitFor(() => expect(proof.agentRecovery).toHaveBeenCalledOnce());
    expect(proof.recovery).toHaveBeenCalledOnce();
    expect(proof.modelCall).not.toHaveBeenCalled();
  });

  it('logs rejected recovery without rejecting server startup', async () => {
    const proof = fixture('auto');
    const error = new Error('recovery storage unavailable');
    const logged = vi.spyOn(mastra.getLogger(), 'error');
    proof.recovery.mockRejectedValue(error);

    await start();

    await vi.waitFor(() => {
      expect(logged).toHaveBeenCalledWith('Failed to recover durable agent runs during server startup', { error });
    });
    expect(proof.recovery).toHaveBeenCalledOnce();
  });

  it('returns the server while recovery is still running', async () => {
    const proof = fixture('auto');
    let finishRecovery!: (value: { agents: number; recovered: number; succeeded: number; failed: number }) => void;
    const recoveryResult = new Promise<Awaited<ReturnType<Mastra['recoverAllDurableAgents']>>>(resolve => {
      finishRecovery = resolve;
    });
    proof.recovery.mockReturnValue(recoveryResult);
    const startup = start();
    let returned = false;
    void startup.then(() => {
      returned = true;
    });

    try {
      await vi.waitFor(() => expect(returned).toBe(true));
      expect(server).toBeDefined();
      expect(proof.recovery).toHaveBeenCalledOnce();
    } finally {
      finishRecovery({ agents: 1, recovered: 0, succeeded: 0, failed: 0 });
      await startup;
    }
  });

  it('installs native shutdown handlers before starting recovery', async () => {
    const proof = fixture('auto');
    const order: string[] = [];
    const nativeRecovery = Mastra.prototype.recoverAllDurableAgents;
    proof.recovery.mockImplementation(() => {
      for (const [signal, previous] of listeners) {
        expect(process.listeners(signal).length).toBeGreaterThan(previous.length);
      }
      order.push('recovery');
      return nativeRecovery.call(mastra);
    });

    await start();
    expect(order).toEqual(['recovery']);
  });
});
