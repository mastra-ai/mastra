/**
 * A resume that dies mid-segment (#27619, #27752). Resuming a durable run marks
 * it `running`, so a process killed while resuming leaves a `running` row with
 * no live owner. A later approve from another process must refuse while the dead
 * claimant's lease is still live, then take the run over once it lapses.
 *
 * Real processes sharing one LibSQL file, because the run registry and execution
 * fences are module-level: in one process the killed resume's state would still
 * be there. The model is MastraLanguageModelV2Mock rather than aimock because
 * the scripted turns run inside the killed peer and nothing here asserts model
 * behaviour; the shared tool log counts tool runs across both processes.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { afterEach, describe, expect, it } from 'vitest';

import { LibSQLStore } from '../../storage';
import { createCrashAgent } from './fixtures/resume-crash-agent';
import type { CrashAt } from './fixtures/resume-crash-agent';
import type { CrashPeerArgs } from './fixtures/resume-crash-peer';
import { bootWorkers, createXprocEnv, PEER_TIMEOUT_MS } from './peer-helper';
import type { XprocEnv } from './peer-helper';

const FIXTURE = new URL('./fixtures/resume-crash-peer.ts', import.meta.url);
/** The peer's lease TTL: long enough to approve inside it, short enough to wait out. */
const PEER_LEASE_TTL_MS = 3_000;
const TEST_TIMEOUT_MS = PEER_TIMEOUT_MS + 20_000;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type Engine = 'durable' | 'evented';

describe('approving a run whose previous resume process died', () => {
  let env: XprocEnv | undefined;
  let storage: LibSQLStore | undefined;
  let mastra: Mastra | undefined;

  afterEach(async () => {
    await mastra?.shutdown();
    await env?.cleanup();
    await storage?.close();
    env = storage = mastra = undefined;
  });

  async function killMidResume(engine: Engine, crashAt: CrashAt) {
    env = await createXprocEnv({ workers: true });
    const logPath = path.join(env.dir, 'tool.log');
    const previous = process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS;
    process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = String(PEER_LEASE_TTL_MS);
    let peer;
    try {
      peer = await env.spawnPeer<CrashPeerArgs>(
        FIXTURE,
        { engine, crashAt, policy: 'off', logPath },
        { role: 'replica-a', workers: true },
      );
    } finally {
      if (previous === undefined) delete process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS;
      else process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = previous;
    }
    const { runId, toolCallId } = await peer.waitFor<{ runId: string; toolCallId: string }>('crash-point', {
      timeoutMs: PEER_TIMEOUT_MS,
    });
    await peer.kill();
    const killedAt = Date.now();

    storage = new LibSQLStore({ id: 'resume-takeover-main', url: env.dbUrl });
    const { agent } = createCrashAgent({ logPath, crashAt: 'none' });
    const runner = engine === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
    mastra = new Mastra({
      agents: { crash: runner },
      storage,
      pubsub: env.pubsub(),
      logger: false,
      recovery: { durableAgents: 'off' },
    });
    await bootWorkers(mastra, true);

    const loopStatus = async () => {
      const store = (await storage!.getStore('workflows'))!;
      const { runs } = await store.listWorkflowRuns({});
      const row = runs.find(r => r.runId === runId && r.workflowName === 'durable-agentic-loop');
      if (!row) return undefined;
      const snapshot = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot;
      return snapshot?.status as string | undefined;
    };
    const toolLog = () =>
      existsSync(logPath)
        ? readFileSync(logPath, 'utf8')
            .trim()
            .split('\n')
            .map(line => line.split(' ')[0])
        : [];
    const approve = async () => {
      const stream = await runner.approveToolCall({ runId, toolCallId });
      const finishes: string[] = [];
      for await (const chunk of stream.fullStream as AsyncIterable<any>) {
        if (chunk.type === 'finish') finishes.push(chunk.payload?.stepResult?.reason);
      }
      return finishes;
    };
    const waitForLeaseToLapse = () => sleep(Math.max(0, killedAt + PEER_LEASE_TTL_MS + 1_000 - Date.now()));

    return { runId, runner, loopStatus, toolLog, approve, waitForLeaseToLapse };
  }

  it.each(['mid-tool', 'after-tool'] as const)(
    'durable, killed %s: refuses while the lease is live, then resumes the run',
    async crashAt => {
      const { runId, runner, loopStatus, toolLog, approve, waitForLeaseToLapse } = await killMidResume(
        'durable',
        crashAt,
      );
      expect(await loopStatus()).toBe('running');

      await expect(approve()).rejects.toMatchObject({ id: 'AGENT_RESUME_ALREADY_CLAIMED' });

      await waitForLeaseToLapse();
      expect(await approve()).toEqual(['stop']);
      expect((await runner.listSuspendedRuns()).runs.map(r => r.runId)).not.toContain(runId);
      // Same count as main, where the row stayed `suspended` and a retry re-ran the tool:
      // a killed tool runs again, and so does one that committed before the kill (#27752 gap B).
      expect(toolLog()).toEqual(
        crashAt === 'mid-tool' ? ['start', 'start', 'commit'] : ['start', 'commit', 'start', 'commit'],
      );
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'evented, killed mid-tool: refuses while the lease is live, then reports that recovery finished the run',
    async () => {
      const { loopStatus, toolLog, approve, waitForLeaseToLapse } = await killMidResume('evented', 'mid-tool');
      expect(await loopStatus()).toBe('running');

      await expect(approve()).rejects.toMatchObject({ id: 'AGENT_RESUME_ALREADY_CLAIMED' });

      await waitForLeaseToLapse();
      await expect(approve()).rejects.toMatchObject({ id: 'AGENT_RESUME_RUN_FINISHED' });
      expect(await loopStatus()).toBeUndefined();
      expect(toolLog().filter(entry => entry === 'commit')).toHaveLength(1);
    },
    TEST_TIMEOUT_MS,
  );
});
