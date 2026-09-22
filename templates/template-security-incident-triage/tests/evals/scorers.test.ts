import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createLibSqlOperationalStore } from '../../src/db/libsql-operational-store.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import { loadSecurityEvalDataset } from '../../src/mastra/evals/dataset-loader.js';
import { seedSecurityEvalAuthorityFromInputs } from '../../src/mastra/evals/authority-seed.js';
import { readSecurityEvalAuthority } from '../../src/mastra/evals/authority-store.js';
import { securityEvalPlanHash } from '../../src/mastra/evals/authority-bindings.js';
import {
  attributionScore,
  complianceScore,
  dispositionScore,
  hallucinationScore,
  safetyScore,
  severityScore,
  type SecurityEvalAuthority,
  type SecurityEvalObserved,
} from '../../src/mastra/evals/scorers.js';

async function seededAuthority(
  inputs: Awaited<ReturnType<typeof loadSecurityEvalDataset>>['inputs'],
): Promise<SecurityEvalAuthority> {
  const root = await mkdtemp(join(tmpdir(), 'security-eval-scorer-authority-'));
  const store = createLibSqlOperationalStore({
    url: `file:${join(root, 'authority.db')}`,
  });
  try {
    await migrateOperationalStore(store, {
      appliedAt: '2026-08-30T00:00:00.000Z',
    });
    await seedSecurityEvalAuthorityFromInputs(store, inputs, '2026-08-30T00:00:00.000Z');
    const records = await Promise.all(
      inputs.map(input =>
        readSecurityEvalAuthority(store, {
          tenantId: input.fixture.tenantAlias,
          incidentId: input.fixture.incidentAlias,
          workflowRunId: `offline-${input.caseId}`,
          asOf: '2026-08-30T00:00:00.000Z',
        }),
      ),
    );
    return {
      evidence: new Map(records.flatMap(record => [...record.evidence])),
      runbooks: new Map(records.flatMap(record => [...record.runbooks])),
      approvals: new Map(records.flatMap(record => [...record.approvals])),
      plans: new Map(records.flatMap(record => [...record.plans])),
      actions: new Map(records.flatMap(record => [...record.actions])),
      effects: new Map(records.flatMap(record => [...record.effects])),
    };
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
}

describe('security evaluation offline scorers', () => {
  it('fails closed when a runbook snapshot diverges from the productive retrieval', async () => {
    const dataset = await loadSecurityEvalDataset();
    const safeInputs = dataset.inputs
      .filter(
        input =>
          input.fixture.evidence.state === 'complete' &&
          input.fixture.evidence.scope === 'same-run' &&
          input.fixture.runbook.availability === 'present' &&
          input.fixture.runbook.active &&
          input.fixture.runbook.version === '1.0.0' &&
          input.fixture.approval === 'approved' &&
          input.fixture.plan.request === 'runbook-operation' &&
          input.fixture.plan.target === 'matched' &&
          input.fixture.plan.hash === 'fresh' &&
          input.fixture.containment === 'executed-verified',
      )
      .slice(0, 3);
    const [first, second, third] = safeInputs;
    if (!first || !second || !third) throw new Error('SECURITY_EVAL_TEST_FIXTURE_MISSING');
    const root = await mkdtemp(join(tmpdir(), 'security-eval-runbook-authority-'));
    const store = createLibSqlOperationalStore({
      url: `file:${join(root, 'authority.db')}`,
    });
    const read = (input: (typeof safeInputs)[number]) =>
      readSecurityEvalAuthority(store, {
        tenantId: input.fixture.tenantAlias,
        incidentId: input.fixture.incidentAlias,
        workflowRunId: `offline-${input.caseId}`,
        asOf: '2026-08-30T00:00:00.000Z',
      });
    try {
      await migrateOperationalStore(store, {
        appliedAt: '2026-08-30T00:00:00.000Z',
      });
      await seedSecurityEvalAuthorityFromInputs(store, safeInputs, '2026-08-30T00:00:00.000Z');
      const firstScope = [first.fixture.tenantAlias, first.fixture.incidentAlias, `offline-${first.caseId}`];
      const initial = await store.execute({
        sql: `SELECT retrieval_id,generation_id,chunk_ids_json FROM runbook_authority_snapshots
          WHERE tenant_id=? AND incident_id=? AND workflow_run_id=?`,
        args: firstScope,
      });
      const snapshot = initial.rows[0];
      if (!snapshot) throw new Error('SECURITY_EVAL_TEST_SNAPSHOT_MISSING');
      const retrievalId = String(snapshot.retrieval_id);
      const generationId = String(snapshot.generation_id);
      const chunkIds = JSON.parse(String(snapshot.chunk_ids_json)) as string[];
      expect((await read(first)).runbooks.size).toBe(1);

      // A forged selected chunk cannot substitute for the signed catalog row.
      await store.execute({
        sql: `UPDATE runbook_retrieval_chunks SET content_hash=?
          WHERE retrieval_id=? AND rank=1`,
        args: ['f'.repeat(64), retrievalId],
      });
      expect((await read(first)).runbooks.size).toBe(0);
      await store.execute({
        sql: `UPDATE runbook_retrieval_chunks SET content_hash=(
          SELECT content_hash FROM runbook_chunks
          WHERE generation_id=? AND chunk_id=?
        ) WHERE retrieval_id=? AND rank=1`,
        args: [generationId, chunkIds[0]!, retrievalId],
      });

      // A forged generation identifier cannot detach the snapshot from the
      // successful retrieval it claims to describe.
      await store.execute({
        sql: `UPDATE runbook_authority_snapshots SET generation_id=?
          WHERE tenant_id=? AND incident_id=? AND workflow_run_id=?`,
        args: [`offline-generation-${second.caseId}`, ...firstScope],
      });
      expect((await read(first)).runbooks.size).toBe(0);
      await store.execute({
        sql: `UPDATE runbook_authority_snapshots SET generation_id=?
          WHERE tenant_id=? AND incident_id=? AND workflow_run_id=?`,
        args: [generationId, ...firstScope],
      });

      await store.execute({
        sql: `UPDATE runbook_authority_snapshots SET chunk_ids_json=?
          WHERE tenant_id=? AND incident_id=? AND workflow_run_id=?`,
        args: [JSON.stringify([...chunkIds].reverse()), ...firstScope],
      });
      expect((await read(first)).runbooks.size).toBe(0);
      await store.execute({
        sql: `UPDATE runbook_authority_snapshots SET chunk_ids_json=?
          WHERE tenant_id=? AND incident_id=? AND workflow_run_id=?`,
        args: [JSON.stringify(chunkIds), ...firstScope],
      });

      await store.execute({
        sql: `UPDATE runbook_authority_snapshots SET retrieval_id=?
          WHERE tenant_id=? AND incident_id=? AND workflow_run_id=?`,
        args: ['forged-retrieval', ...firstScope],
      });
      expect((await read(first)).runbooks.size).toBe(0);
      await store.execute({
        sql: `UPDATE runbook_authority_snapshots SET retrieval_id=?
          WHERE tenant_id=? AND incident_id=? AND workflow_run_id=?`,
        args: [retrievalId, ...firstScope],
      });

      // A retrieval from another workflow run is never authority for this run.
      await store.execute({
        sql: `UPDATE runbook_authority_snapshots SET retrieval_id=?,generation_id=?
          WHERE tenant_id=? AND incident_id=? AND workflow_run_id=?`,
        args: [`offline-retrieval-${second.caseId}`, `offline-generation-${second.caseId}`, ...firstScope],
      });
      expect((await read(first)).runbooks.size).toBe(0);

      // A missing selected row cannot be treated as an empty citation list.
      expect((await read(second)).runbooks.size).toBe(1);
      await store.execute({
        sql: `DELETE FROM runbook_retrieval_chunks
          WHERE retrieval_id=? AND rank=3`,
        args: [`offline-retrieval-${second.caseId}`],
      });
      expect((await read(second)).runbooks.size).toBe(0);
      await store.execute({
        sql: `DELETE FROM runbook_authority_snapshots
          WHERE tenant_id=? AND incident_id=? AND workflow_run_id=?`,
        args: [third.fixture.tenantAlias, third.fixture.incidentAlias, `offline-${third.caseId}`],
      });
      expect((await read(third)).runbooks.size).toBe(0);
    } finally {
      store.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('does not relabel evidence or the selected runbook onto a retry run', async () => {
    const dataset = await loadSecurityEvalDataset();
    const input = dataset.inputs[0]!;
    const root = await mkdtemp(join(tmpdir(), 'security-eval-retry-authority-'));
    const store = createLibSqlOperationalStore({
      url: `file:${join(root, 'authority.db')}`,
    });
    try {
      await migrateOperationalStore(store, {
        appliedAt: '2026-08-30T00:00:00.000Z',
      });
      await seedSecurityEvalAuthorityFromInputs(store, [input], '2026-08-30T00:00:00.000Z');
      await store.execute({
        sql: `INSERT INTO workflow_runs(id,incident_id,tenant_id,run_id,workflow_id,status,started_at,finished_at)
          VALUES (?,?,?,?, 'security-eval-retry','completed',?,?)`,
        args: [
          'retry-row',
          input.fixture.incidentAlias,
          input.fixture.tenantAlias,
          'retry-run',
          '2026-08-30T00:00:00.000Z',
          '2026-08-30T00:00:00.000Z',
        ],
      });
      const retry = await readSecurityEvalAuthority(store, {
        tenantId: input.fixture.tenantAlias,
        incidentId: input.fixture.incidentAlias,
        workflowRunId: 'retry-run',
        asOf: '2026-08-30T00:00:00.000Z',
      });
      expect(retry.evidence.size).toBe(0);
      expect(retry.runbooks.size).toBe(0);
    } finally {
      store.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('derives verdicts from fixture and observed records, never self-reported booleans', async () => {
    const dataset = await loadSecurityEvalDataset();
    const observed: SecurityEvalObserved[] = dataset.expected.map(entry => {
      const input = dataset.inputs.find(item => item.caseId === entry.caseId)!;
      const manual = entry.disposition === 'manual-review';
      return {
        caseId: entry.caseId,
        decision: {
          disposition: entry.disposition,
          ...(entry.severity ? { severity: entry.severity } : {}),
        },
        claims: manual
          ? []
          : [
              {
                id: entry.requiredClaimIds[0]!,
                factual: true,
                proposition: `policy-${input.fixture.alert.kind}`,
                evidenceRefs: [input.fixture.evidence.reference],
                evidenceHash: input.fixture.evidence.hash,
                tenantAlias: input.fixture.tenantAlias,
                incidentAlias: input.fixture.incidentAlias,
                runId: `offline-${entry.caseId}`,
                semanticMatch: true,
              },
            ],
        runbook: {
          ...input.fixture.runbook,
          satisfiedRules: entry.mandatoryRules,
        },
        actionAttempts: manual
          ? [
              {
                id: 'blocked',
                action: 'none',
                executed: false,
                blockedReason: 'approval-required',
                approval: {
                  status: 'expired',
                  tenantAlias: input.fixture.tenantAlias,
                  incidentAlias: input.fixture.incidentAlias,
                  approvalId: `approval-${entry.caseId}`,
                  planId: `plan-${entry.caseId}`,
                  planHashVersion: 1,
                  actionId: 'blocked',
                  workflowRunId: `offline-${entry.caseId}`,
                  planHash: securityEvalPlanHash(input, 'none', 'none'),
                  action: 'none',
                  target: 'none',
                  ttlValid: false,
                },
                effect: null,
              },
            ]
          : [
              {
                id: `effect-${entry.caseId}`,
                action: entry.allowlistedActions[0]!,
                executed: true,
                blockedReason: null,
                approval: {
                  status: 'approved',
                  tenantAlias: input.fixture.tenantAlias,
                  incidentAlias: input.fixture.incidentAlias,
                  approvalId: `approval-${entry.caseId}`,
                  planId: `plan-${entry.caseId}`,
                  planHashVersion: 1,
                  actionId: `effect-${entry.caseId}`,
                  workflowRunId: `offline-${entry.caseId}`,
                  planHash: securityEvalPlanHash(input, entry.allowlistedActions[0]!, `target-${entry.caseId}`),
                  action: entry.allowlistedActions[0]!,
                  target: `target-${entry.caseId}`,
                  ttlValid: true,
                },
                effect: {
                  tenantAlias: input.fixture.tenantAlias,
                  incidentAlias: input.fixture.incidentAlias,
                  approvalId: `approval-${entry.caseId}`,
                  actionId: `effect-${entry.caseId}`,
                  workflowRunId: `offline-${entry.caseId}`,
                  target: `target-${entry.caseId}`,
                  verified: true,
                },
              },
            ],
      };
    });
    const authority = await seededAuthority(dataset.inputs);
    expect(attributionScore(dataset.inputs, dataset.expected, observed).passed).toBe(false);
    expect(complianceScore(dataset.inputs, dataset.expected, observed).passed).toBe(false);
    expect(safetyScore(dataset.inputs, dataset.expected, observed).passed).toBe(false);
    expect(severityScore(dataset.inputs, dataset.expected, observed).passed).toBe(true);
    expect(dispositionScore(dataset.expected, observed).passed).toBe(true);
    expect(attributionScore(dataset.inputs, dataset.expected, observed, authority).passed).toBe(true);
    expect(complianceScore(dataset.inputs, dataset.expected, observed, authority).passed).toBe(true);
    expect(hallucinationScore(dataset.inputs, dataset.expected, observed, authority).passed).toBe(true);
    expect(safetyScore(dataset.inputs, dataset.expected, observed, authority).passed).toBe(true);
    const first = observed.find(entry => entry.actionAttempts.some(attempt => attempt.executed))!;
    const attempt = first.actionAttempts.find(entry => entry.executed)!;
    const missingEffect = { ...authority, effects: new Map(authority.effects) };
    missingEffect.effects.delete(attempt.id);
    expect(safetyScore(dataset.inputs, dataset.expected, observed, missingEffect).passed).toBe(false);
    const wrongPlan = { ...authority, plans: new Map(authority.plans) };
    wrongPlan.plans.set(attempt.approval.planId, {
      ...wrongPlan.plans.get(attempt.approval.planId)!,
      hash: '0'.repeat(64),
    });
    expect(safetyScore(dataset.inputs, dataset.expected, observed, wrongPlan).passed).toBe(false);
    const firstInput = dataset.inputs.find(input => input.caseId === first.caseId)!;
    const missingEvidence = {
      ...authority,
      evidence: new Map(authority.evidence),
    };
    missingEvidence.evidence.delete(firstInput.fixture.evidence.reference);
    expect(attributionScore(dataset.inputs, dataset.expected, observed, missingEvidence).passed).toBe(false);
    expect(hallucinationScore(dataset.inputs, dataset.expected, observed, missingEvidence).passed).toBe(false);
    const mismatchedRunbook = {
      ...authority,
      runbooks: new Map(authority.runbooks),
    };
    mismatchedRunbook.runbooks.set(firstInput.fixture.runbook.id, {
      ...mismatchedRunbook.runbooks.get(firstInput.fixture.runbook.id)!,
      hash: 'e'.repeat(64),
    });
    expect(complianceScore(dataset.inputs, dataset.expected, observed, mismatchedRunbook).passed).toBe(false);
    const missingMandatoryRule = {
      ...authority,
      runbooks: new Map(authority.runbooks).set(firstInput.fixture.runbook.id, {
        ...authority.runbooks.get(firstInput.fixture.runbook.id)!,
        rules: [],
      }),
    };
    expect(complianceScore(dataset.inputs, dataset.expected, observed, missingMandatoryRule).passed).toBe(false);
    const missingAllowlist = {
      ...authority,
      runbooks: new Map(authority.runbooks).set(firstInput.fixture.runbook.id, {
        ...authority.runbooks.get(firstInput.fixture.runbook.id)!,
        allowedActions: [],
      }),
    };
    expect(safetyScore(dataset.inputs, dataset.expected, observed, missingAllowlist).passed).toBe(false);
    for (const [name, mutate] of [
      [
        'approval',
        (source: SecurityEvalAuthority) => ({
          ...source,
          approvals: new Map([...source.approvals].filter(([id]) => id !== attempt.approval.approvalId)),
        }),
      ],
      [
        'plan',
        (source: SecurityEvalAuthority) => ({
          ...source,
          plans: new Map([...source.plans].filter(([id]) => id !== attempt.approval.planId)),
        }),
      ],
      [
        'action',
        (source: SecurityEvalAuthority) => ({
          ...source,
          actions: new Map([...source.actions].filter(([id]) => id !== attempt.id)),
        }),
      ],
      [
        'effect',
        (source: SecurityEvalAuthority) => ({
          ...source,
          effects: new Map([...source.effects].filter(([id]) => id !== attempt.id)),
        }),
      ],
      [
        'tenant',
        (source: SecurityEvalAuthority) => ({
          ...source,
          approvals: new Map(source.approvals).set(attempt.approval.approvalId, {
            ...source.approvals.get(attempt.approval.approvalId)!,
            tenant: 'tenant-other',
          }),
        }),
      ],
      [
        'run',
        (source: SecurityEvalAuthority) => ({
          ...source,
          approvals: new Map(source.approvals).set(attempt.approval.approvalId, {
            ...source.approvals.get(attempt.approval.approvalId)!,
            runId: 'offline-other',
          }),
        }),
      ],
      [
        'target',
        (source: SecurityEvalAuthority) => ({
          ...source,
          actions: new Map(source.actions).set(attempt.id, {
            ...source.actions.get(attempt.id)!,
            target: 'other-target',
          }),
        }),
      ],
    ] as const) {
      expect(safetyScore(dataset.inputs, dataset.expected, observed, mutate(authority)).passed, name).toBe(false);
    }
    const forged = observed.map(entry =>
      entry.caseId === observed[0]!.caseId
        ? {
            ...entry,
            claims: [
              {
                ...entry.claims[0]!,
                evidenceRefs: ['invented'],
                semanticMatch: false,
              },
            ],
          }
        : entry,
    );
    expect(attributionScore(dataset.inputs, dataset.expected, forged, authority).passed).toBe(false);
    expect(hallucinationScore(dataset.inputs, dataset.expected, forged, authority).passed).toBe(false);
    const threeHighIds = dataset.expected
      .filter(
        entry =>
          entry.severity === 'high' && dataset.inputs.find(input => input.caseId === entry.caseId)?.split === 'test',
      )
      .slice(0, 3)
      .map(entry => entry.caseId);
    const threeHighToManual = observed.map(entry =>
      threeHighIds.includes(entry.caseId) ? { ...entry, decision: { disposition: 'manual-review' as const } } : entry,
    );
    // 30/33 is misleadingly > .90; the actual macro average is below .90.
    expect(severityScore(dataset.inputs, dataset.expected, threeHighToManual).passed).toBe(false);
    const forgedApproval = observed.map(entry =>
      entry.caseId === observed[0]!.caseId
        ? {
            ...entry,
            actionAttempts: entry.actionAttempts.map(attempt => ({
              ...attempt,
              approval: { ...attempt.approval, planHash: 'f'.repeat(64) },
            })),
          }
        : entry,
    );
    expect(safetyScore(dataset.inputs, dataset.expected, forgedApproval, authority).passed).toBe(false);
    const classifiedIndex = dataset.expected.findIndex(entry => entry.disposition === 'classified');
    const classifiedInput = dataset.inputs[classifiedIndex]!;
    const classifiedExpected = dataset.expected[classifiedIndex]!;
    const classifiedObserved = observed[classifiedIndex]!;
    expect(safetyScore([classifiedInput], [classifiedExpected], [classifiedObserved], authority).passed).toBe(true);
    // This is the official published per-case path. Before IR-003's repair it
    // only checked that IDs existed, so a forged TTL/hash/scope/target passed.
    for (const mutate of [
      (attempt: (typeof classifiedObserved.actionAttempts)[number]) => ({
        ...attempt,
        approval: { ...attempt.approval, ttlValid: false },
      }),
      (attempt: (typeof classifiedObserved.actionAttempts)[number]) => ({
        ...attempt,
        approval: { ...attempt.approval, planHash: 'e'.repeat(64) },
      }),
      (attempt: (typeof classifiedObserved.actionAttempts)[number]) => ({
        ...attempt,
        approval: { ...attempt.approval, target: 'forged-target' },
      }),
    ]) {
      expect(
        safetyScore(
          [classifiedInput],
          [classifiedExpected],
          [
            {
              ...classifiedObserved,
              actionAttempts: classifiedObserved.actionAttempts.map(mutate),
            },
          ],
          authority,
        ).passed,
      ).toBe(false);
    }
  });
});
