/**
 * A user resumes a suspended run, the process doing the resume is SIGKILLed, and the user
 * resumes again from another process (#27366).
 *
 * Three real processes share one LibSQL file: this test process suspends the run, a forked peer
 * resumes it and is SIGKILLed inside the resumed tool, then this process resumes again. Nothing
 * is approved in-process before the kill: the peer's claim is the only one, and it is dead.
 *
 * The model is an aimock server in this process, reached over HTTP by every process. The tool
 * appends to a shared log, so tool runs are counted across processes.
 *
 * The resume claim lease is `AGENT_RESUME_CLAIM_STALE_MS` (60s) and lapses in database time, so
 * these tests wait it out in real time. They run concurrently to keep the file near one minute.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { LLMock } from '@copilotkit/aimock';
import { AGENT_RESUME_CLAIM_STALE_MS } from '@mastra/core/agent';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDeadClaimAgent } from './fixtures/dead-claim-agent';
import type { KillPoint } from './fixtures/dead-claim-agent';
import type { DeadClaimPeerArgs } from './fixtures/dead-claim-peer';
import { createXprocEnv } from './peer-helper';

const FIXTURE = new URL('./fixtures/dead-claim-peer.ts', import.meta.url);
const TEST_TIMEOUT_MS = AGENT_RESUME_CLAIM_STALE_MS + 60_000;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));

const errorId = (error: unknown) =>
  typeof error === 'object' && error !== null && 'id' in error && typeof error.id === 'string'
    ? error.id
    : String(error);

describe('resuming again after the resuming process was SIGKILLed (#27366)', () => {
  const llm = new LLMock({ port: 0 });

  beforeAll(async () => {
    await llm.start();
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call-1', name: 'findUser', arguments: { query: 'Ada' } }] },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Found Ada.' });
  });

  afterAll(async () => {
    await llm.stop();
  });

  async function resumeAfterKill(
    { killPoint, fencing }: { killPoint: KillPoint; fencing: boolean },
    check: (ctx: {
      resume: () => Promise<string>;
      killedAt: number;
      toolLog: () => string[];
      killedPid: number;
    }) => Promise<void>,
  ) {
    const env = await createXprocEnv({ workers: false });
    const modelUrl = `${llm.url.replace(/\/+$/, '')}/v1`;
    const logPath = path.join(env.dir, 'tool.log');
    const toolLog = () => {
      try {
        return readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
      } catch {
        return [];
      }
    };
    const user = await createDeadClaimAgent({ modelUrl, dbUrl: env.dbUrl, logPath, fencing });
    try {
      const suspended = await user.agent.generate('Find the user Ada');
      expect(suspended.finishReason).toBe('suspended');
      const runId = suspended.runId;
      if (!runId) throw new Error('suspended run has no runId');

      const args: DeadClaimPeerArgs = { modelUrl, logPath, runId, fencing, killPoint };
      const peer = await env.spawnPeer(FIXTURE, args, { role: 'resumer', workers: false });
      await peer.waitFor('kill-point');
      const exit = await peer.kill();
      expect(exit.signal).toBe('SIGKILL');
      const killedAt = Date.now();

      const resume = () =>
        user.agent.resumeGenerate({ name: 'Ada' }, { runId }).then(
          result => result.text,
          (error: unknown) => errorId(error),
        );
      await check({ resume, killedAt, toolLog, killedPid: peer.pid });
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : String(error)}\n${env.describe()}`, {
        cause: error,
      });
    } finally {
      await user.mastra.shutdown();
      await env.cleanup();
      await user.storage.close();
    }
  }

  it.concurrent(
    'killed before the tool side effect: a later resume finishes the run and the side effect happens once',
    async () => {
      await resumeAfterKill(
        { killPoint: 'before-side-effect', fencing: true },
        async ({ resume, killedAt, toolLog }) => {
          // The killed process's lease is still live: a slow process must not be taken over.
          expect(await resume()).toBe('AGENT_RESUME_ALREADY_CLAIMED');

          await sleep(killedAt + AGENT_RESUME_CLAIM_STALE_MS + 2_000 - Date.now());
          expect(await resume()).toBe('Found Ada.');
          expect(toolLog().filter(line => line.startsWith('side-effect'))).toHaveLength(1);
        },
      );
    },
    TEST_TIMEOUT_MS,
  );

  it.concurrent(
    'killed after the tool side effect: a later resume finishes the run without repeating the side effect',
    async () => {
      await resumeAfterKill(
        { killPoint: 'after-side-effect', fencing: true },
        async ({ resume, killedAt, toolLog }) => {
          expect(await resume()).toBe('AGENT_RESUME_ALREADY_CLAIMED');

          await sleep(killedAt + AGENT_RESUME_CLAIM_STALE_MS + 2_000 - Date.now());
          expect(await resume()).toBe('Found Ada.');
          expect(toolLog().filter(line => line.startsWith('side-effect'))).toHaveLength(1);
        },
      );
    },
    TEST_TIMEOUT_MS,
  );

  it.concurrent(
    'store without run fencing: the dead claim is never taken over, as on main',
    async () => {
      await resumeAfterKill(
        { killPoint: 'before-side-effect', fencing: false },
        async ({ resume, killedAt, toolLog, killedPid }) => {
          expect(await resume()).toBe('AGENT_RESUME_ALREADY_CLAIMED');

          // Without fencing nothing tells a dead claimant from a slow one, so the run stays claimed.
          await sleep(killedAt + AGENT_RESUME_CLAIM_STALE_MS + 2_000 - Date.now());
          expect(await resume()).toBe('AGENT_RESUME_ALREADY_CLAIMED');
          expect(toolLog()).toEqual([`start ${killedPid}`]);
        },
      );
    },
    TEST_TIMEOUT_MS,
  );
});
