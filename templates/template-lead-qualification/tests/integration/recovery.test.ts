import { z } from 'zod';
import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';
import { describe, expect, it, vi } from 'vitest';
import { event } from '../support/application';

async function child(directory: string, hold: boolean) {
  const process = fork(
    fileURLToPath(new URL('../support/intake-child.ts', import.meta.url)),
    [directory, hold ? 'hold' : 'recover'],
    {
      execArgv: ['--import', 'tsx'],
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: { ...globalThis.process.env, OPENAI_API_KEY: '', MASTRA_TELEMETRY_DISABLED: '1' },
    },
  );
  let output = '';
  process.stderr?.on('data', data => {
    output += String(data);
  });
  const port = await new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Child startup timed out: ${output}`)), 30_000);
    process.once('error', reject);
    process.once('exit', code => {
      clearTimeout(timeout);
      reject(new Error(`Child exited ${code}: ${output}`));
    });
    process.on('message', (message: unknown) => {
      const ready = message as { type?: string; port?: number };
      if (ready.type === 'ready' && ready.port) {
        clearTimeout(timeout);
        resolve(ready.port);
      }
    });
  });
  return { process, baseUrl: `http://127.0.0.1:${port}` };
}
async function terminate(child: ChildProcess, signal: NodeJS.Signals = 'SIGKILL') {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill(signal);
  await exited;
}

describe('process recovery', () => {
  it('deduplicates_and_recovers_accepted_events', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lead-recovery-'));
    const database = createClient({ url: pathToFileURL(join(directory, 'application.db')).href });
    let first: Awaited<ReturnType<typeof child>> | undefined;
    let recovered: Awaited<ReturnType<typeof child>> | undefined;
    try {
      first = await child(directory, true);
      const payload = event('restart-delivery', { domain: 'example.com' });
      const submit = (baseUrl: string) =>
        fetch(`${baseUrl}/lead-qualification/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      const responses = await Promise.all(Array.from({ length: 12 }, () => submit(first!.baseUrl)));
      expect(responses.map(response => response.status)).toEqual(Array(12).fill(202));
      const associations = await Promise.all(responses.map(response => response.json()));
      const runId = associations[0]!.runId as string;
      expect(new Set(associations.map(value => value.runId)).size).toBe(1);
      const original = await database.execute('SELECT run_id, status, dispatch_attempts FROM lead_runs');
      expect(original.rows).toHaveLength(1);
      expect(original.rows[0]).toMatchObject({ run_id: runId, status: 'accepted', dispatch_attempts: 0 });
      expect((await database.execute('SELECT count(*) AS count FROM lead_deliveries')).rows[0]!.count).toBe(1);
      expect((await database.execute('SELECT count(*) AS count FROM mastra_workflow_snapshot')).rows[0]!.count).toBe(0);
      // The child holds dispatch through constructor injection. No product fault endpoint exists.
      const killed = once(first.process, 'exit');
      first.process.kill('SIGKILL');
      expect(await killed).toEqual([null, 'SIGKILL']);
      recovered = await child(directory, false);
      await vi.waitFor(
        async () => {
          const response = await fetch(`${recovered!.baseUrl}/lead-qualification/runs/${runId}`);
          expect(response.status).toBe(200);
          expect((await response.json()).status).toBe('intake_received');
        },
        { timeout: 20_000 },
      );
      const replay = await submit(recovered.baseUrl);
      expect(replay.status).toBe(202);
      expect((await replay.json()).runId).toBe(runId);
      const final = await database.execute('SELECT run_id, status, dispatch_attempts FROM lead_runs');
      expect(final.rows).toHaveLength(1);
      expect(final.rows[0]).toMatchObject({ run_id: runId, status: 'intake_received', dispatch_attempts: 1 });
      const snapshots = await database.execute(
        'SELECT run_id, json(snapshot) AS snapshot FROM mastra_workflow_snapshot',
      );
      expect(snapshots.rows).toHaveLength(1);
      expect(snapshots.rows[0]!.run_id).toBe(runId);
      expect(JSON.parse(z.string().parse(snapshots.rows[0]!.snapshot)).status).toBe('suspended');
      const status = await (await fetch(`${recovered.baseUrl}/lead-qualification/runs/${runId}`)).json();
      expect(status.business.state).toBe('awaiting_review');
      const rejected = await fetch(`${recovered.baseUrl}/lead-qualification/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          reviewId: status.business.packet.id,
          revision: 1,
          digest: status.business.packet.digest,
          decision: 'rejected',
        }),
      });
      expect(rejected.status).toBe(200);
      await vi.waitFor(async () => {
        const current = await (await fetch(`${recovered!.baseUrl}/lead-qualification/runs/${runId}`)).json();
        expect(current.business.state).toBe('rejected');
        expect(current.business.active).toBe(false);
      });
      // A deliberate later cycle for this domain is not permanently deduplicated.
      const later = await fetch(`${recovered.baseUrl}/lead-qualification/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...event('later-delivery', { domain: 'example.com', reference: 'restart-delivery' }),
          supersedesAssessmentId: status.qualification.assessment.id,
        }),
      });
      expect(later.status).toBe(202);
      expect((await later.json()).runId).not.toBe(runId);
      recovered.process.send('stop');
      await once(recovered.process, 'exit');
    } finally {
      if (first) await terminate(first.process);
      if (recovered) await terminate(recovered.process);
      database.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
