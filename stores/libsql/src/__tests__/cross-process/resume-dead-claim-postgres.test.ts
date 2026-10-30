/**
 * A user resumes a suspended run on Postgres, the process doing the resume is SIGKILLed, and
 * the user resumes again from another process (#27366).
 *
 * Three real processes share one Postgres schema: this test process suspends the run, a forked
 * peer resumes it and is SIGKILLed inside the resumed tool, then this process resumes again.
 * Nothing is approved in-process before the kill: the peer's claim is the only one, and it is dead.
 *
 * This is the store the claim lives in. The LibSQL file case next to this file does not show what
 * Postgres does with a dead running claim.
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

import { createDeadClaimPgAgent } from './fixtures/dead-claim-pg-agent';
import type { KillPoint } from './fixtures/dead-claim-pg-agent';
import type { DeadClaimPgPeerArgs } from './fixtures/dead-claim-pg-peer';
import { createXprocEnv } from './peer-helper';

const FIXTURE = new URL('./fixtures/dead-claim-pg-peer.ts', import.meta.url);
const TEST_TIMEOUT_MS = AGENT_RESUME_CLAIM_STALE_MS + 60_000;
const CONNECTION_STRING = process.env.DB_URL ?? '';
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));

const errorId = (error: unknown) =>
  typeof error === 'object' && error !== null && 'id' in error && typeof error.id === 'string'
    ? error.id
    : String(error);

describe.skipIf(!CONNECTION_STRING)(
  'resuming again after the resuming process was SIGKILLed, on Postgres (#27366)',
  () => {
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
      killPoint: KillPoint,
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
      const user = await createDeadClaimPgAgent({ modelUrl, connectionString: CONNECTION_STRING, logPath });
      try {
        const suspended = await user.agent.generate('Find the user Ada');
        expect(suspended.finishReason).toBe('suspended');
        const runId = suspended.runId;
        if (!runId) throw new Error('suspended run has no runId');

        const args: DeadClaimPgPeerArgs = {
          modelUrl,
          connectionString: CONNECTION_STRING,
          schema: user.schema,
          logPath,
          runId,
          killPoint,
        };
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
        await user.dropSchema();
        await user.mastra.shutdown();
        await env.cleanup();
        await user.storage.close();
      }
    }

    it.concurrent(
      'killed before the tool side effect: a later resume finishes and executes the side effect once',
      async () => {
        await resumeAfterKill('before-side-effect', async ({ resume, killedAt, toolLog, killedPid }) => {
          expect(await resume()).toBe('AGENT_RESUME_ALREADY_CLAIMED');

          await sleep(killedAt + AGENT_RESUME_CLAIM_STALE_MS + 2_000 - Date.now());
          expect(await resume()).toBe('Found Ada.');
          expect(toolLog().filter(line => line.startsWith('side-effect'))).toHaveLength(1);
          expect(toolLog()[0]).toBe(`start ${killedPid}`);
        });
      },
      TEST_TIMEOUT_MS,
    );

    it.concurrent(
      'killed after the tool side effect: a later resume finishes but replays the side effect',
      async () => {
        await resumeAfterKill('after-side-effect', async ({ resume, killedAt, toolLog, killedPid }) => {
          expect(await resume()).toBe('AGENT_RESUME_ALREADY_CLAIMED');

          await sleep(killedAt + AGENT_RESUME_CLAIM_STALE_MS + 2_000 - Date.now());
          expect(await resume()).toBe('Found Ada.');
          expect(toolLog().filter(line => line.startsWith('side-effect'))).toHaveLength(2);
          expect(toolLog().slice(0, 2)).toEqual([`start ${killedPid}`, `side-effect ${killedPid}`]);
        });
      },
      TEST_TIMEOUT_MS,
    );
  },
);
