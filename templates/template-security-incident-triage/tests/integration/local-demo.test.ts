import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ingestDemoWithRecovery } from '../../scripts/demo/intake-recovery.js';
import { InProcessDomainPubSub } from '../../src/workers/in-process-domain-pubsub.js';
import { createReadOnlyLibSqlOperationalStore } from '../../src/db/libsql-operational-store.js';
import { pathToFileURL } from 'node:url';

const exec = promisify(execFile);
let directory: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'security-local-demo-test-'));
});
afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

describe('key-free signed-webhook local demo', () => {
  it('closes the owned intake store and transport when intake throws', async () => {
    const close = vi.fn();
    const closeTransport = vi.spyOn(InProcessDomainPubSub.prototype, 'close');
    try {
      await expect(
        ingestDemoWithRecovery(
          () => ({
            execute: async () => {
              throw new Error('synthetic-storage-failure');
            },
            transaction: async () => {
              throw new Error('unexpected transaction');
            },
            close,
          }),
          'unauthorized_privilege_change',
        ),
      ).rejects.toThrow('synthetic-storage-failure');
      expect(close).toHaveBeenCalledOnce();
      expect(closeTransport).toHaveBeenCalledOnce();
    } finally {
      closeTransport.mockRestore();
    }
  });
  it('executes three real background workflows, recovers outbox, gates and verifies effects', async () => {
    const output = join(directory, 'demo');
    await exec(process.execPath, ['--import', 'tsx', 'scripts/demo-local.ts', '--output', output], {
      timeout: 60_000,
      maxBuffer: 2_000_000,
    });
    const report = JSON.parse(await readFile(join(output, 'demo-report.json'), 'utf8'));
    expect(report.passed).toBe(true);
    expect(report.cases).toHaveLength(3);
    expect(report.cases.map((item: { severity: string }) => item.severity)).toEqual(['high', 'medium', 'medium']);
    for (const item of report.cases) {
      expect(item).toMatchObject({
        invalidSignatureStatus: 401,
        acceptedStatus: 202,
        duplicateIncident: true,
        recoveredAfterTransportRestart: true,
        nativeStartAsyncCalls: 1,
        workflowCreateRunCalls: 1,
        duplicateDeliveryStarts: 0,
        beforeApprovalEffects: 0,
        verifiedEffects: 2,
        status: 'closed',
        outcome: 'contained',
        externalOperations: ['create', 'update'],
      });
      const store = createReadOnlyLibSqlOperationalStore({
        url: pathToFileURL(join(output, item.database)).href,
      });
      try {
        const counts = await store.execute({
          sql: "SELECT (SELECT count(*) FROM incidents) AS incidents,(SELECT count(*) FROM workflow_runs) AS workflows,(SELECT count(*) FROM local_containment_effects) AS effects,(SELECT count(*) FROM containment_action_attempts WHERE verification='verified') AS verified",
        });
        expect(counts.rows[0]).toEqual({
          incidents: 1,
          workflows: 1,
          effects: 2,
          verified: 2,
        });
        const published = await store.execute({
          sql: 'SELECT published_at,attempt_count FROM outbox_events WHERE id=?',
          args: [item.workflowRunId],
        });
        expect(published.rows[0]?.published_at).toBeTruthy();
        expect(Number(published.rows[0]?.attempt_count)).toBeGreaterThanOrEqual(1);
      } finally {
        store.close();
      }
    }
    await expect(
      exec(process.execPath, ['--import', 'tsx', 'scripts/demo-local.ts', '--output', output]),
    ).rejects.toMatchObject({ code: 1 });
  }, 60_000);
});
