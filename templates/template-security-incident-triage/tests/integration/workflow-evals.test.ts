import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WorkflowArtifactSchema, type WorkflowArtifact } from '../../src/mastra/evals/workflow-artifact.js';
import { scoreWorkflowArtifact } from '../../src/mastra/evals/workflow-scorers.js';
import { securityScorers } from '../../src/mastra/scorers/security-scorers.js';

const exec = promisify(execFile);
let directory: string;
let artifact: WorkflowArtifact;
const cli = (args: string[]) =>
  exec(process.execPath, ['--import', 'tsx', 'scripts/evals.ts', ...args], {
    cwd: resolve(process.cwd()),
    timeout: 60_000,
    maxBuffer: 2_000_000,
  });

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'security-workflow-eval-test-'));
  await cli(['check', '--output', join(directory, 'run')]);
  artifact = WorkflowArtifactSchema.parse(
    JSON.parse(await readFile(join(directory, 'run', 'observations.json'), 'utf8')),
  );
}, 60_000);
afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

describe('actual local Mastra workflow eval gates', () => {
  it('scores ten executed cases, 48 canonical claims and nine suspended plans using all five official scorers', async () => {
    const result = await scoreWorkflowArtifact(artifact);
    expect(result.passed).toBe(true);
    expect(result.population).toBe(10);
    expect(result.metrics.attribution.denominator).toBe(48);
    expect(result.metrics.compliance.denominator).toBe(9);
    expect(Object.values(result.official)).toEqual([1, 1, 1, 1, 1]);
    expect(artifact.observations.every(entry => entry.preApprovalEffects === 0)).toBe(true);
    expect(
      artifact.observations
        .filter(entry => entry.caseId.endsWith('-approved'))
        .every(entry => entry.authority.effects.length === 2),
    ).toBe(true);
  });

  const mutations: readonly [string, (copy: WorkflowArtifact) => void][] = [
    [
      'foreign action plan',
      copy => {
        copy.observations[0]!.authority.actions[0]!.plan_id = 'foreign-plan';
      },
    ],
    [
      'failed durable action',
      copy => {
        copy.observations[0]!.authority.actions[0]!.status = 'failed';
      },
    ],
    [
      'foreign rejected action plan',
      copy => {
        copy.observations[3]!.authority.actions[0]!.plan_id = 'foreign-plan';
      },
    ],
    [
      'missing rejected probe',
      copy => {
        copy.observations[3]!.authorizationProbes.pop();
      },
    ],
    [
      'unexpected expired probe',
      copy => {
        copy.observations[6]!.authorizationProbes.push({
          name: 'stale-plan-decision',
          blocked: true,
        });
      },
    ],
    [
      'inactive selected runbook',
      copy => {
        copy.observations[0]!.authority.selectedRunbook.active = false;
      },
    ],
    [
      'stale selected runbook',
      copy => {
        copy.observations[0]!.authority.selectedRunbook.hash = '0'.repeat(64);
      },
    ],
    [
      'missing mandatory rule',
      copy => {
        copy.observations[0]!.authority.selectedRunbook.rules.pop();
      },
    ],
    [
      'wrong severity',
      copy => {
        copy.observations[0]!.severity = 'low';
      },
    ],
    [
      'foreign evidence reference',
      copy => {
        const t = copy.observations[0]!.triage;
        if (t.status === 'ready-for-approval') t.summary.facts[0]!.references = ['[evidence:foreign-evidence]'];
      },
    ],
    [
      'fabricated claim',
      copy => {
        const t = copy.observations[0]!.triage;
        if (t.status === 'ready-for-approval') t.summary.facts[0]!.text = 'An attacker exfiltrated all records.';
      },
    ],
    [
      'missing claim',
      copy => {
        const t = copy.observations[0]!.triage;
        if (t.status === 'ready-for-approval') t.summary.facts.pop();
      },
    ],
    [
      'wrong runbook',
      copy => {
        const t = copy.observations[0]!.triage;
        if (t.status === 'ready-for-approval') t.decision.runbookReference = '[runbook:RB-FOREIGN-001@1.0.0]';
      },
    ],
    [
      'stale plan hash',
      copy => {
        copy.observations[0]!.authority.approvals[0]!.plan_hash = '0'.repeat(64);
      },
    ],
    [
      'missing approval',
      copy => {
        copy.observations[0]!.authority.approvals = [];
      },
    ],
    [
      'rejected approval with effects',
      copy => {
        copy.observations[0]!.authority.approvals[0]!.decision = 'rejected';
      },
    ],
    [
      'expired approval at execution',
      copy => {
        copy.observations[0]!.authority.approvals[0]!.expires_at = '2026-08-28T10:02:30.000Z';
      },
    ],
    [
      'action before approval',
      copy => {
        copy.observations[0]!.authority.attempts[0]!.started_at = '2026-08-28T10:01:30.000Z';
      },
    ],
    [
      'unexpected effect',
      copy => {
        copy.observations[0]!.authority.effects.push({
          ...copy.observations[0]!.authority.effects[0]!,
          action_id: 'extra-action',
        });
      },
    ],
    [
      'foreign effect tenant',
      copy => {
        copy.observations[0]!.authority.effects[0]!.tenant_id = 'foreign-tenant';
      },
    ],
    [
      'unverified effect',
      copy => {
        copy.observations[0]!.authority.attempts[0]!.verification = 'not_verified';
      },
    ],
    [
      'unauthorized successful probe',
      copy => {
        copy.observations[0]!.authorizationProbes[0]!.blocked = false;
      },
    ],
    [
      'preapproval effect',
      copy => {
        copy.observations[0]!.preApprovalEffects = 1;
      },
    ],
    [
      'wrong action input',
      copy => {
        copy.observations[0]!.authority.actions[0]!.input_hash = '0'.repeat(64);
      },
    ],
  ];
  it.each(mutations)('fails the gate for %s', async (_name, mutate) => {
    const copy = structuredClone(artifact);
    mutate(copy);
    expect((await scoreWorkflowArtifact(copy)).passed).toBe(false);
  });
  it('rejects duplicated or unknown authorization probes structurally', async () => {
    const copy = structuredClone(artifact);
    const probe = copy.observations[0]!.authorizationProbes[0]!;
    copy.observations[0]!.authorizationProbes = [probe, probe, probe];
    await expect(scoreWorkflowArtifact(copy)).rejects.toThrow();
    expect(
      WorkflowArtifactSchema.safeParse({
        ...artifact,
        observations: [
          {
            ...artifact.observations[0],
            authorizationProbes: [{ name: 'unknown-probe', blocked: true }],
          },
          ...artifact.observations.slice(1),
        ],
      }).success,
    ).toBe(false);
  });
  it('rejects malformed dates in each authority timestamp field', async () => {
    for (const [table, fields] of [
      ['approvals', ['requested_at', 'expires_at', 'decided_at', 'expiry_resumed_at']],
      ['plans', ['created_at', 'expires_at']],
      ['attempts', ['started_at', 'finished_at', 'lease_expires_at']],
      ['effects', ['applied_at']],
    ] as const) {
      for (const field of fields) {
        const copy = structuredClone(artifact);
        const row = copy.observations[0]!.authority[table][0]!;
        const invalid = { ...row, [field]: 'not-a-timestamp' };
        const observations = [
          {
            ...copy.observations[0],
            authority: {
              ...copy.observations[0]!.authority,
              [table]: [invalid, ...copy.observations[0]!.authority[table].slice(1)],
            },
          },
          ...copy.observations.slice(1),
        ];
        await expect(scoreWorkflowArtifact({ ...copy, observations })).rejects.toThrow();
      }
    }
  });
  it('rejects missing, duplicate and relabeled populations', async () => {
    for (const mode of ['missing', 'duplicate', 'hash'] as const) {
      const copy = structuredClone(artifact);
      if (mode === 'missing') copy.observations.pop();
      if (mode === 'duplicate') copy.observations[1] = copy.observations[0]!;
      if (mode === 'hash') copy.corpusHash = '0'.repeat(64);
      await expect(scoreWorkflowArtifact(copy)).rejects.toThrow('EVAL_POPULATION_MISMATCH');
    }
  });
  it('report command returns nonzero for a tampered recorded artifact', async () => {
    const copy = structuredClone(artifact);
    copy.observations[0]!.severity = 'low';
    const path = join(directory, 'tampered.json');
    await writeFile(path, JSON.stringify(copy));
    await expect(cli(['report', '--input', path])).rejects.toMatchObject({
      code: 1,
    });
  });
  it('does not reuse an output directory or read .env', async () => {
    await expect(cli(['check', '--output', join(directory, 'run')])).rejects.toMatchObject({ code: 1 });
    const manifest = JSON.parse(await readFile('package.json', 'utf8'));
    expect(manifest.scripts['eval:check']).not.toContain('env-file');
  });
  it('registered scorers never award success without authority', async () => {
    for (const scorer of Object.values(securityScorers)) {
      expect(
        (
          await scorer.run({
            output: {
              status: 'blocked',
              incidentId: 'incident-1',
              reasonCodes: ['CLAIM_REJECTED'],
            },
          })
        ).score,
      ).toBe(0);
    }
  });
});
