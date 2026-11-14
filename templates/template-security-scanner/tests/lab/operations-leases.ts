import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { expect } from 'vitest';
import { InvestigationStore, type Hypothesis } from '../../src/investigation/store.js';
import { ReferenceCatalog } from '../../src/knowledge/catalog.js';
import { PlaybookRegistry } from '../../src/knowledge/playbooks.js';
import { drainOffline } from '../../src/runtime/operations.js';
import { discoveryCase, startDiscoveryLab } from './harness.js';
import { investigation } from './investigation.js';
/** Interrupt active verification and approval leases and verify their durable recovery. */
export async function activeLeaseCrash() {
  const lab = await startDiscoveryLab();
  const selected = await discoveryCase(lab, { path: '/owned/ssrf/vulnerable' });
  const admitted = await selected.admit();
  expect(admitted.status).toBe(202);
  const scan = await lab.wait(String(admitted.data.id));
  expect(scan.state).toBe('COMPLETED');
  const inventory = z
    .object({
      items: z.array(
        z
          .object({
            id: z.string().uuid(),
            observation: z.object({ kind: z.string(), path: z.string() }).passthrough(),
          })
          .passthrough(),
      ),
    })
    .passthrough()
    .parse((await lab.request(`/api/scans/${scan.id}/inventory`)).data);
  const surface = inventory.items.find(
    item => item.observation.kind === 'form' && item.observation.path === '/owned/ssrf/vulnerable',
  );
  expect(surface).toBeDefined();
  const run = await investigation(lab, scan, 1),
    store = new InvestigationStore(lab.settings.databaseUrl),
    catalog = new ReferenceCatalog(lab.settings.databaseUrl);
  await store.initialize();
  await catalog.initialize();
  const books = new PlaybookRegistry(catalog);
  await books.initialize();
  let child: ReturnType<typeof fork> | undefined;
  try {
    const full = await store.getInvestigation(run.id, 'local-operator');
    await store.beginPlanning(run.id, 'local-operator');
    // Seed only the planning boundary from real retained evidence and a current
    // playbook binding. Queue, approval, lease/fence and recovery remain real.
    const hypothesis: Hypothesis = {
      id: randomUUID(),
      owner: 'local-operator',
      investigationId: run.id,
      lineage: full.lineage,
      resourceBindingId: null,
      ruleBinding: await books.binding('ssrf'),
      origin: 'playbook',
      category: 'ssrf',
      toolId: 'check_owned_ssrf',
      scanId: scan.id,
      evidenceIds: [surface!.id],
      referenceIds: ['WSTG-INPV-19'],
      preconditions: [],
      expectedBehavior: 'Only the approved owned callback receives a request.',
      risk: 'active',
      maxRequests: 1,
      maxDurationSeconds: 15,
      maxTokens: 128,
      maxRefinements: 0,
      state: 'AWAITING_APPROVAL',
      reason: null,
      createdAt: new Date().toISOString(),
    };
    await store.enqueue(hypothesis, 'dupin');
    await store.finishPlanning(run.id, 'local-operator');
    const approval = await lab.request(`/api/hypotheses/${hypothesis.id}/approval`, 'POST', {
      callback: `http://${lab.boundary.address}:18080/owned/callback`,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    });
    expect(approval.status).toBe(201);
    expect(
      (
        await lab.request(
          `/api/approvals/${approval.data.id}/decision`,
          'POST',
          { decision: 'approved', revision: approval.data.revision },
          Number(approval.data.revision),
        )
      ).status,
    ).toBe(200);
    const before = (await lab.stats())['owned-callback-received'] ?? 0;
    child = fork(resolve(import.meta.dirname, 'lease-worker.ts'), [lab.settings.databaseUrl], {
      execArgv: ['--import', 'tsx'],
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: { HOME: process.env.HOME, PATH: process.env.PATH },
    });
    const exited = new Promise<void>(resolve => child!.once('exit', () => resolve()));
    const job = await new Promise<{ id: string; fence: number; reservedRequests: number }>((resolveJob, reject) => {
      const timer = setTimeout(() => {
        child!.kill('SIGKILL');
        reject(new Error('LEASE_CLAIM_TIMEOUT'));
      }, 10000);
      child!.on('message', message => {
        const ready = z.object({ ready: z.literal(true) }).safeParse(message);
        if (ready.success) {
          child!.send('claim');
          return;
        }
        const parsed = z
          .object({
            job: z.object({ id: z.string().uuid(), fence: z.number().int(), reservedRequests: z.number().int() }),
          })
          .safeParse(message);
        if (parsed.success) {
          clearTimeout(timer);
          resolveJob(parsed.data.job);
        }
      });
    });
    expect(job.reservedRequests).toBe(1);
    expect((await store.approvalForJob(job.id, 'local-operator'))?.consumed).toBe(true);
    child.kill('SIGKILL');
    await exited;
    child = undefined;
    await lab.stop();
    expect((await drainOffline(lab.settings)).state).toBe('DRAINED');
    await lab.restart();
    const recovered = await store.getJob(job.id, 'local-operator');
    expect(recovered).toMatchObject({
      state: 'DEAD',
      fence: job.fence + 1,
      attempts: 1,
      result: { outcome: 'EXECUTION_ERROR', reason: 'ACTIVE_PROBE_OUTCOME_UNKNOWN' },
    });
    expect((await store.getInvestigation(run.id, 'local-operator')).usedRequests).toBe(1);
    expect((await store.approvalForJob(job.id, 'local-operator'))?.decision).toBe('expired');
    await expect(
      store.publish(
        job.id,
        'local-operator',
        job.fence,
        { outcome: 'CONFIRMED', evidenceIds: [], reason: 'STALE_RESULT', modelId: null, usageTokens: null },
        true,
      ),
    ).rejects.toMatchObject({ code: 'LEASE_STALE' });
    expect(await store.claim('local-operator', 30000, 2, 1)).toBeNull();
    expect((await lab.stats())['owned-callback-received'] ?? 0).toBe(before);
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await store.close();
    catalog.close();
  }
}
