import { appendFile, cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertDatasetContract,
  materializedVectors,
  SecurityEvalRequiredVectors,
  policyNormalizedSignature,
  sha256Canonical,
  sha256Text,
} from '../../src/mastra/evals/dataset-contract.js';
import { loadSecurityEvalDataset } from '../../src/mastra/evals/dataset-loader.js';

const directory = resolve('src/mastra/evals/datasets/v1');

describe('security evaluation dataset contract', () => {
  it('rejects tampering with the approved historical runbook snapshot', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'security-eval-provenance-'));
    try {
      await cp(directory, root, { recursive: true });
      await loadSecurityEvalDataset({ datasetDirectory: root });
      await appendFile(resolve(root, 'runbooks/disallowed-country-login.md'), '\nUnapproved policy change.\n');
      await expect(loadSecurityEvalDataset({ datasetDirectory: root })).rejects.toThrow(
        'SECURITY_EVAL_DATASET_RUNBOOK_PROVENANCE_INVALID',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('materializes the A1 population, controls, and 72 policy-normalized families', async () => {
    const dataset = await loadSecurityEvalDataset();
    expect(dataset.manifest).toMatchObject({
      approvalStatus: 'approved',
      approvedBy: 'Diego',
      approvedAt: '2026-08-30T20:53:10.000Z',
      provenance: {
        independentReviewers: [
          'security-eval-internal-review-14:a376550707c33bb38824a2b9134ab263493298e32a62518c7f6ba4406002b97c',
        ],
      },
    });
    expect(dataset.inputs).toHaveLength(72);
    expect(dataset.expected.filter(entry => entry.disposition === 'classified')).toHaveLength(54);
    expect(dataset.expected.filter(entry => entry.disposition === 'manual-review')).toHaveLength(18);
    expect(Object.values(dataset.manifest.counts).slice(1, 4)).toEqual([36, 12, 24]);
    const signatures = dataset.inputs.map(policyNormalizedSignature);
    expect(new Set(signatures)).toHaveLength(72);
    expect(
      dataset.inputs.map(input =>
        policyNormalizedSignature({
          ...input,
          fixture: {
            ...input.fixture,
            facts: input.fixture.facts.map(fact => ({
              ...fact,
              confidence: 0.99,
            })),
          },
        }),
      ),
    ).toEqual(signatures);
    const confidenceLabels = new Map<string, Set<string>>();
    const labelConfidences = new Map<string, Set<number>>();
    for (const expected of dataset.expected.filter(entry => entry.disposition === 'classified')) {
      const input = dataset.inputs.find(entry => entry.caseId === expected.caseId)!;
      const bucket = String(input.fixture.facts[0]!.confidence);
      const labels = confidenceLabels.get(bucket) ?? new Set<string>();
      labels.add(expected.severity!);
      confidenceLabels.set(bucket, labels);
      const confidences = labelConfidences.get(expected.severity!) ?? new Set();
      confidences.add(input.fixture.facts[0]!.confidence);
      labelConfidences.set(expected.severity!, confidences);
    }
    expect([...confidenceLabels.values()].every(labels => labels.size > 1)).toBe(true);
    expect([...labelConfidences.values()].every(values => values.size > 1)).toBe(true);
    for (const input of dataset.inputs) {
      const evidence = input.fixture.evidence;
      const currentRun = `offline-${input.caseId}`;
      if (evidence.scope === 'same-run') {
        expect(evidence.ownerTenantAlias).toBe(input.fixture.tenantAlias);
        expect(evidence.ownerIncidentAlias).toBe(input.fixture.incidentAlias);
        expect(evidence.ownerRunAlias).toBe(currentRun);
      }
      if (evidence.scope === 'cross-run') {
        expect(evidence.ownerTenantAlias).toBe(input.fixture.tenantAlias);
        expect(evidence.ownerIncidentAlias).toBe(input.fixture.incidentAlias);
        expect(evidence.ownerRunAlias).not.toBe(currentRun);
      }
    }
    for (const scenario of ['privilege', 'country', 'device'] as const)
      for (const severity of ['low', 'medium', 'high'] as const) {
        const cases = dataset.expected
          .filter(
            expected =>
              expected.severity === severity &&
              dataset.inputs.find(input => input.caseId === expected.caseId)!.scenario === scenario,
          )
          .map(expected => policyNormalizedSignature(dataset.inputs.find(input => input.caseId === expected.caseId)!));
        expect(cases).toHaveLength(6);
        expect(new Set(cases)).toHaveLength(6);
      }
    expect(new Set(dataset.inputs.filter(entry => entry.split === 'test').map(policyNormalizedSignature))).toHaveLength(
      24,
    );
    for (const vector of SecurityEvalRequiredVectors) {
      expect(dataset.manifest.coverage.vectors[vector]).toBeGreaterThan(0);
      expect(dataset.inputs.some(input => materializedVectors(input).includes(vector))).toBe(true);
    }
    for (const input of dataset.inputs) {
      expect(input.fixture.facts).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ key: 'risk.signal' })]),
      );
      expect(input.tags.filter(tag => tag.startsWith('vector:'))).toEqual(
        materializedVectors(input).map(vector => `vector:${vector}`),
      );
    }
  });

  it('rejects the seventh-review cross-split policy-normalized duplicate probe', async () => {
    const [manifestText, inputText, expectedText] = await Promise.all([
      readFile(resolve(directory, 'manifest.json'), 'utf8'),
      readFile(resolve(directory, 'inputs.jsonl'), 'utf8'),
      readFile(resolve(directory, 'expected.jsonl'), 'utf8'),
    ]);
    const manifest = JSON.parse(manifestText) as {
      hashes: Record<string, string>;
    } & Record<string, unknown>;
    const inputs = inputText
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    const source = inputs.find(item => item.caseId === 'security-v1-privilege-01')!;
    const targetIndex = inputs.findIndex(item => item.caseId === 'security-v1-privilege-17');
    inputs[targetIndex] = {
      ...source,
      caseId: 'security-v1-privilege-17',
      split: 'test',
    };
    const alteredInputText = `${inputs.map(item => JSON.stringify(item)).join('\n')}\n`;
    manifest.hashes.inputs = sha256Text(alteredInputText);
    manifest.hashes.manifest = sha256Canonical({
      ...manifest,
      hashes: {
        inputs: manifest.hashes.inputs,
        expected: manifest.hashes.expected,
      },
    });
    expect(() =>
      assertDatasetContract({
        manifest,
        inputs,
        expected: expectedText
          .trim()
          .split('\n')
          .map(line => JSON.parse(line)),
        inputText: alteredInputText,
        expectedText,
      }),
    ).toThrow('SECURITY_EVAL_DATASET_LEAKAGE_INVALID');
  });

  it('rejects a same-run owner alias that does not bind to the canonical run', async () => {
    const [manifestText, inputText, expectedText] = await Promise.all([
      readFile(resolve(directory, 'manifest.json'), 'utf8'),
      readFile(resolve(directory, 'inputs.jsonl'), 'utf8'),
      readFile(resolve(directory, 'expected.jsonl'), 'utf8'),
    ]);
    const manifest = JSON.parse(manifestText) as {
      hashes: Record<string, string>;
    } & Record<string, unknown>;
    const inputs = inputText
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    const target = inputs.find(item => item.caseId === 'security-v1-privilege-01')!;
    target.fixture.evidence.ownerRunAlias = 'offline-security-v1-privilege-1';
    const alteredInputText = `${inputs.map(item => JSON.stringify(item)).join('\n')}\n`;
    manifest.hashes.inputs = sha256Text(alteredInputText);
    manifest.hashes.manifest = sha256Canonical({
      ...manifest,
      hashes: {
        inputs: manifest.hashes.inputs,
        expected: manifest.hashes.expected,
      },
    });
    expect(() =>
      assertDatasetContract({
        manifest,
        inputs,
        expected: expectedText
          .trim()
          .split('\n')
          .map(line => JSON.parse(line)),
        inputText: alteredInputText,
        expectedText,
      }),
    ).toThrow('SECURITY_EVAL_DATASET_EVIDENCE_SCOPE_INVALID');
  });
});
