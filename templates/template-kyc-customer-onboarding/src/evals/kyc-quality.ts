import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Mastra } from '@mastra/core/mastra';
import { z } from 'zod';

import { providerExecutionContextSchema } from '../contracts/shared/execution-context.js';
import { loadExtractionQualityPolicy } from '../config/policies/extraction-quality.js';
import { demoDefaultPolicy } from '../config/policies/demo-default.js';
import { demoStrictPolicy } from '../config/policies/demo-strict.js';
import { executionContextSchema } from '../domain/context.js';
import { documentSideSchema, documentTypeSchema } from '../domain/documents.js';
import { evidenceItemSchema, type EvidenceItem } from '../domain/evidence.js';
import { getFixtureScenario } from '../fixtures/provider-scenarios.js';
import { FixedClock } from '../providers/local/deterministic-primitives.js';
import { FixtureDocumentExtractionProvider } from '../providers/local/fixture-document-extraction.js';
import { DeterministicRiskPolicyProvider } from '../providers/local/local-policies.js';
import {
  FixtureAddressVerificationProvider,
  FixtureIdentityVerificationProvider,
} from '../providers/local/fixture-verification.js';
import {
  FixturePepScreeningProvider,
  FixtureSanctionsScreeningProvider,
} from '../providers/local/fixture-screening.js';
import { assessCaseCompleteness } from '../services/completeness-assessment.js';
import manifestJson from './datasets/kyc-evals-v1.json' with { type: 'json' };
import { applyKycEvalReviewHarness, type KycEvalAutomaticCommand } from './kyc-eval-review-harness.js';
import { resolveSourceRevision } from './source-revision.js';
import {
  criticalExtractionFieldsScorer,
  decisionConsistencyScorer,
  evidenceCompletenessScorer,
  escalationScorer,
  kycDatasetScorers,
  kycEvalDatasetIdSchema,
  kycEvalEvidenceRecordSchema,
  kycEvalGroundTruthSchema,
  kycEvalNormalizedFieldSchema,
  kycEvalOutputSchema,
  kycScorers,
  normalizedExtractionScorer,
  policyAdherenceScorer,
  requiredTrajectoryScorer,
  type KycEvalDatasetId,
  type KycEvalGroundTruth,
  type KycEvalOutput,
} from './kyc-scorers.js';

export {
  criticalExtractionFieldsScorer,
  decisionConsistencyScorer,
  evidenceCompletenessScorer,
  escalationScorer,
  kycEvalGroundTruthSchema,
  kycEvalOutputSchema,
  kycScorers,
  normalizedExtractionScorer,
  policyAdherenceScorer,
  requiredTrajectoryScorer,
};

const scenarioInputSchema = z
  .object({
    fixtureScenarioId: z.enum([
      'low-risk',
      'expired-document',
      'unreadable',
      'missing-document-side',
      'identity-mismatch',
      'dob-mismatch',
      'address-mismatch',
      'sanctions-strong',
      'sanctions-ambiguous',
      'pep-candidate',
      'provider-unavailable',
      'high-risk-escalation',
    ]),
    fixtureDigest: z.string().regex(/^[a-f0-9]{64}$/u),
    policyProfile: z.enum(['demo-default', 'demo-strict']).default('demo-default'),
    documentInventory: z
      .array(
        z
          .object({
            type: documentTypeSchema.exclude(['UNKNOWN']),
            side: documentSideSchema,
            extracted: z.boolean(),
          })
          .strict(),
      )
      .default([]),
    repeatCount: z.literal(2),
  })
  .strict();

const scenarioSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/u),
    tags: z.array(z.string().regex(/^[a-z0-9-]+$/u)).min(1),
    input: scenarioInputSchema,
    groundTruth: kycEvalGroundTruthSchema,
  })
  .strict();
const manifestSchema = z
  .object({
    schemaVersion: z.literal('4.0.0'),
    license: z.literal('CC0-1.0'),
    synthetic: z.literal(true),
    datasets: z.record(kycEvalDatasetIdSchema, z.array(z.string()).min(1)),
    scenarios: z.array(scenarioSchema).min(12),
  })
  .strict();

export type KycEvalScenario = z.infer<typeof scenarioSchema>;

const canonicalize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(item => canonicalize(item)).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const forbiddenPii = /\b(?:\d{3}-\d{2}-\d{4}|\d{2}\/\d{2}\/\d{4}|(?:passport|ssn|token|secret)\s*[:=])\b/iu;

export const validateKycEvalManifest = (input: unknown) => {
  const manifest = manifestSchema.parse(input);
  const ids = manifest.scenarios.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) throw new Error('Eval scenario IDs must be unique');
  for (const scenario of manifest.scenarios) {
    const fixture = getFixtureScenario(scenario.input.fixtureScenarioId);
    if (fixture.digest !== scenario.input.fixtureDigest) {
      throw new Error(`Eval scenario ${scenario.id} fixture digest is stale`);
    }
    if (scenario.input.documentInventory.length > 0) {
      const extracted = scenario.input.documentInventory.filter(document => document.extracted);
      if (extracted.length !== 1 || extracted[0]?.type !== fixture.documentType) {
        throw new Error(`Eval scenario ${scenario.id} document inventory is invalid`);
      }
    }
  }
  const known = new Set(ids);
  for (const [datasetId, scenarioIds] of Object.entries(manifest.datasets)) {
    if (new Set(scenarioIds).size !== scenarioIds.length) {
      throw new Error(`Dataset ${datasetId} contains duplicate scenarios`);
    }
    for (const scenarioId of scenarioIds) {
      if (!known.has(scenarioId)) throw new Error(`Dataset ${datasetId} references an unknown scenario`);
    }
  }
  if (manifest.datasets['workflow-trajectories'].length < 12) {
    throw new Error('Workflow trajectory corpus must contain at least 12 scenarios');
  }
  if (forbiddenPii.test(canonicalize(manifest))) throw new Error('Eval manifest contains PII-like data');
  return manifest;
};

export const kycEvalManifest = validateKycEvalManifest(manifestJson);
export const kycEvalRawManifest: unknown = manifestJson;
export const kycEvalManifestDigest = createHash('sha256').update(canonicalize(kycEvalManifest)).digest('hex');
const repositoryRoot = resolve(import.meta.dirname, '../..');
export const kycEvalSourceRevision = resolveSourceRevision(repositoryRoot);

export const kycEvalEvaluatedSourceFiles = [
  'src/evals/kyc-quality.ts',
  'src/evals/source-revision.ts',
  'src/evals/kyc-scorers.ts',
  'src/evals/kyc-eval-review-harness.ts',
  'src/fixtures/provider-scenarios.ts',
  'src/providers/local/fixture-document-extraction.ts',
  'src/providers/local/fixture-verification.ts',
  'src/providers/local/fixture-screening.ts',
  'src/providers/local/local-policies.ts',
  'src/services/completeness-assessment.ts',
  'src/domain/state-machine.ts',
  'src/config/policies/extraction-quality.ts',
  'src/config/policies/demo-default.ts',
  'src/config/policies/demo-strict.ts',
] as const;
export const calculateKycEvalSourceDigest = (
  manifestDigest: string,
  sourceRevision: string,
  sources: readonly Readonly<{ path: string; content: string | Uint8Array }>[],
): string => {
  const evaluatedSourceDigest = createHash('sha256');
  for (const source of sources) {
    evaluatedSourceDigest.update(source.path).update('\0');
    evaluatedSourceDigest.update(source.content).update('\0');
  }
  return createHash('sha256')
    .update(manifestDigest)
    .update('\0')
    .update(sourceRevision)
    .update('\0')
    .update(evaluatedSourceDigest.digest('hex'))
    .digest('hex');
};

export const kycEvalSourceDigest = calculateKycEvalSourceDigest(
  kycEvalManifestDigest,
  kycEvalSourceRevision,
  kycEvalEvaluatedSourceFiles.map(file => ({
    path: file,
    content: readFileSync(resolve(repositoryRoot, file)),
  })),
);

export const buildKycEvalDatasetId = (
  datasetId: KycEvalDatasetId,
  manifestDigest: string,
  sourceDigest: string,
): string => `${datasetId}-v4-${manifestDigest.slice(0, 12)}-${sourceDigest.slice(0, 12)}`;

export const kycEvalDatasetId = (datasetId: KycEvalDatasetId): string =>
  buildKycEvalDatasetId(datasetId, kycEvalManifestDigest, kycEvalSourceDigest);

export const assertKycEvalDatasetProvenance = (
  datasetId: string,
  metadata: Record<string, unknown> | undefined,
): void => {
  if (
    metadata?.manifestDigest !== kycEvalManifestDigest ||
    metadata.sourceRevision !== kycEvalSourceRevision ||
    metadata.sourceDigest !== kycEvalSourceDigest
  ) {
    throw new Error(`Dataset ${datasetId} has stale or divergent provenance`);
  }
};

const scenarios = new Map(kycEvalManifest.scenarios.map(scenario => [scenario.id, scenario]));

const evalClock = new FixedClock(new Date('2026-08-22T12:00:00.000Z'));
const extractionProvider = new FixtureDocumentExtractionProvider(evalClock);
const identityProvider = new FixtureIdentityVerificationProvider(evalClock);
const addressProvider = new FixtureAddressVerificationProvider(evalClock);
const sanctionsProvider = new FixtureSanctionsScreeningProvider(evalClock);
const pepProvider = new FixturePepScreeningProvider(evalClock);
const riskProvider = new DeterministicRiskPolicyProvider();

const normalizedFieldDigest = (field: string, value: string | null): string =>
  createHash('sha256')
    .update(field)
    .update('\0')
    .update(value ?? '<null>')
    .digest('hex');

const toEvalEvidenceRecord = (
  input: z.input<typeof kycEvalEvidenceRecordSchema>,
): z.infer<typeof kycEvalEvidenceRecordSchema> => kycEvalEvidenceRecordSchema.parse(input);

const toRiskEvidence = (input: {
  scenarioId: string;
  type: 'document' | 'identity' | 'address' | 'sanctions' | 'pep' | 'provider-status';
  kind: EvidenceItem['kind'];
  sourceId: string;
  sourceVersion: string;
  status: string;
  reasonCode: string;
  occurredAt: string;
  checkKind?: 'IDENTITY' | 'ADDRESS' | 'SANCTIONS' | 'PEP';
}): EvidenceItem =>
  evidenceItemSchema.parse({
    id: `eval-evidence-${input.scenarioId}-${input.type}-${input.checkKind?.toLowerCase() ?? 'base'}`,
    tenantId: 'eval',
    caseId: `eval-case-${input.scenarioId}`,
    kind: input.kind,
    sourceId: input.sourceId,
    sourceVersion: input.sourceVersion,
    reasonCode: input.reasonCode,
    reasonCodes: [input.reasonCode],
    summary: 'Synthetic PII-free evaluation evidence',
    occurredAt: input.occurredAt,
    metadata: {
      status: input.status,
      ...(input.checkKind === undefined ? {} : { checkKind: input.checkKind }),
    },
  });

export const executeKycEvalScenario = async (
  scenarioId: string,
  input: z.infer<typeof scenarioInputSchema>,
): Promise<KycEvalOutput> => {
  const parsed = scenarioInputSchema.parse(input);
  const fixture = getFixtureScenario(parsed.fixtureScenarioId);
  if (fixture.digest !== parsed.fixtureDigest) {
    throw new Error(`Eval fixture digest mismatch for ${scenarioId}`);
  }
  const selectedPolicy = parsed.policyProfile === 'demo-strict' ? demoStrictPolicy : demoDefaultPolicy;
  const execution = executionContextSchema.parse({
    tenantId: 'eval',
    jurisdiction: 'US',
    piiMode: parsed.policyProfile,
    policy: {
      id: selectedPolicy.id,
      version: selectedPolicy.version,
      checksum: selectedPolicy.checksum,
    },
    locale: 'en-US',
    correlationId: `eval-correlation-${scenarioId}`,
    actor: { type: 'system', id: 'eval-runtime', roles: [] },
  });
  const providerContext = providerExecutionContextSchema.parse({
    execution,
    deadlineAt: '2026-08-22T12:01:00.000Z',
    attempt: 1,
    idempotencyKey: `eval-provider-${scenarioId}-0001`,
  });
  const extraction = await extractionProvider.extract(
    {
      caseId: `eval-case-${scenarioId}`,
      documentId: `eval-document-${scenarioId}`,
      documentTypeHint: fixture.documentType,
      document: {
        storageKey: `synthetic/${scenarioId}.pdf`,
        digest: fixture.digest,
        mimeType: fixture.mimeType,
        sizeBytes: fixture.bytes.byteLength,
      },
      jurisdiction: 'US',
      schemaVersion: '1.0.0',
    },
    providerContext,
  );
  const normalizedFieldDigests = Object.fromEntries(
    kycEvalNormalizedFieldSchema.options.map(field => [
      field,
      normalizedFieldDigest(field, extraction.fields[field].normalizedValue),
    ]),
  );
  const inventory =
    parsed.documentInventory.length === 0
      ? [{ type: fixture.documentType, side: 'SINGLE' as const, extracted: true }]
      : parsed.documentInventory;
  const documents = inventory.map((document, index) => ({
    id: `eval-document-${scenarioId}-${String(index + 1)}`,
    tenantId: 'eval',
    caseId: `eval-case-${scenarioId}`,
    type: document.type,
    side: document.side,
    content: {
      storageKey: `synthetic/${scenarioId}-${String(index + 1)}.pdf`,
      digest: fixture.digest,
      mimeType: fixture.mimeType,
      sizeBytes: fixture.bytes.byteLength,
    },
    createdAt: evalClock.now().toISOString(),
    updatedAt: evalClock.now().toISOString(),
    version: 1,
  }));
  const completeness = assessCaseCompleteness({
    tenantId: 'eval',
    caseId: `eval-case-${scenarioId}`,
    documents,
    extractions: inventory.flatMap((document, index) =>
      document.extracted
        ? [
            {
              documentId: `eval-document-${scenarioId}-${String(index + 1)}`,
              result: { fields: extraction.fields, quality: extraction.quality },
            },
          ]
        : [],
    ),
    policy: selectedPolicy,
    qualityPolicy: loadExtractionQualityPolicy(parsed.policyProfile),
    completedRounds: 0,
  });
  const hardStopTriggered = completeness.status !== 'COMPLETE';
  const documentOccurredAt = extraction.provider.completedAt;
  const evidenceRecords = [
    toEvalEvidenceRecord({
      type: 'document',
      sourceId: extraction.provider.providerId,
      sourceVersion: extraction.provider.providerVersion,
      status: extraction.quality,
      reasonCode: extraction.quality === 'UNREADABLE' ? 'DOCUMENT_UNREADABLE' : 'DOCUMENT_EXTRACTED',
      occurredAt: documentOccurredAt,
      referenceId: `eval-evidence-${scenarioId}-document`,
    }),
  ];
  const riskEvidence: EvidenceItem[] = [
    toRiskEvidence({
      scenarioId,
      type: 'document',
      kind: 'DOCUMENT_EXTRACTION',
      sourceId: extraction.provider.providerId,
      sourceVersion: extraction.provider.providerVersion,
      status: extraction.quality,
      reasonCode: extraction.quality === 'UNREADABLE' ? 'DOCUMENT_UNREADABLE' : 'DOCUMENT_EXTRACTED',
      occurredAt: documentOccurredAt,
    }),
  ];
  const commands: KycEvalAutomaticCommand[] = ['SUBMIT_APPLICATION', 'BEGIN_EXTRACTION'];
  let riskRoute: KycEvalOutput['riskRoute'] = 'NOT_APPLICABLE';
  if (hardStopTriggered) {
    commands.push('REQUEST_INFORMATION');
  } else {
    commands.push('BEGIN_CHECKS');
    const checkInput = {
      caseId: `eval-case-${scenarioId}`,
      jurisdiction: 'US',
      policyVersion: selectedPolicy.version,
    };
    const identity = await identityProvider.verify(
      {
        ...checkInput,
        applicationFullName: fixture.application.fullName,
        extractedFullName: extraction.fields.fullName.normalizedValue,
      },
      providerContext,
    );
    const address = await addressProvider.verify(
      {
        ...checkInput,
        applicationAddress: fixture.application.residentialAddress,
        extractedAddress: extraction.fields.residentialAddress.normalizedValue,
      },
      providerContext,
    );
    const screeningInput = {
      ...checkInput,
      fullName: fixture.application.fullName,
      aliases: [],
      dateOfBirth: fixture.application.dateOfBirth,
      nationality: fixture.application.nationality,
    };
    const [sanctions, pep] = await Promise.all([
      sanctionsProvider.screen(screeningInput, providerContext),
      pepProvider.screen(screeningInput, providerContext),
    ]);
    const checks = [
      {
        type: 'identity' as const,
        kind: 'IDENTITY_CHECK' as const,
        checkKind: 'IDENTITY' as const,
        result: identity,
      },
      {
        type: 'address' as const,
        kind: 'ADDRESS_CHECK' as const,
        checkKind: 'ADDRESS' as const,
        result: address,
      },
      {
        type: 'sanctions' as const,
        kind: 'SANCTIONS_CHECK' as const,
        checkKind: 'SANCTIONS' as const,
        result: sanctions,
      },
      {
        type: 'pep' as const,
        kind: 'PEP_CHECK' as const,
        checkKind: 'PEP' as const,
        result: pep,
      },
    ];
    for (const check of checks) {
      const unavailable = check.result.status === 'ERROR' || check.result.status === 'INCONCLUSIVE';
      const type = unavailable ? ('provider-status' as const) : check.type;
      const kind = unavailable ? ('PROVIDER_UNAVAILABLE' as const) : check.kind;
      const reasonCode = check.result.reasonCodes[0];
      if (reasonCode === undefined) throw new Error(`Eval ${check.type} result lacks a reason code`);
      evidenceRecords.push(
        toEvalEvidenceRecord({
          type,
          sourceId: check.result.providerId,
          sourceVersion: check.result.providerVersion,
          status: check.result.status,
          reasonCode,
          occurredAt: check.result.completedAt,
          referenceId: `eval-evidence-${scenarioId}-${check.type}`,
        }),
      );
      riskEvidence.push(
        toRiskEvidence({
          scenarioId,
          type,
          kind,
          sourceId: check.result.providerId,
          sourceVersion: check.result.providerVersion,
          status: check.result.status,
          reasonCode,
          occurredAt: check.result.completedAt,
          checkKind: check.checkKind,
        }),
      );
    }
    const risk = await riskProvider.evaluate({
      tenantId: 'eval',
      caseId: `eval-case-${scenarioId}`,
      policy: selectedPolicy,
      evidence: riskEvidence,
      evidenceCompleteness: 'COMPLETE',
      missingInformationExhausted: false,
      assessedAt: evalClock.now().toISOString(),
    });
    riskRoute = risk.route;
    evidenceRecords.push(
      toEvalEvidenceRecord({
        type: 'risk',
        sourceId: risk.engine.id,
        sourceVersion: risk.engine.version,
        status: risk.route,
        reasonCode: `RISK_ROUTE_${risk.route}`,
        occurredAt: risk.assessedAt,
        referenceId: `eval-evidence-${scenarioId}-risk`,
      }),
    );
    commands.push('BEGIN_RISK_ASSESSMENT', 'REQUEST_COMPLIANCE_REVIEW');
  }
  const trajectory = applyKycEvalReviewHarness({
    scenarioId,
    automaticCommands: commands,
    reviewAction: 'NONE',
  }).trajectory;
  return kycEvalOutputSchema.parse({
    normalizedFieldDigests,
    hardStopTriggered,
    riskRoute,
    evidenceRecords,
    automaticCommands: commands,
    trajectory,
  });
};

export const createBaselineOutput = (groundTruth: KycEvalGroundTruth): KycEvalOutput => {
  const automaticCommands: KycEvalAutomaticCommand[] = groundTruth.hardStopRequired
    ? ['SUBMIT_APPLICATION', 'BEGIN_EXTRACTION', 'REQUEST_INFORMATION']
    : ['SUBMIT_APPLICATION', 'BEGIN_EXTRACTION', 'BEGIN_CHECKS', 'BEGIN_RISK_ASSESSMENT', 'REQUEST_COMPLIANCE_REVIEW'];
  return kycEvalOutputSchema.parse({
    hardStopTriggered: groundTruth.hardStopRequired,
    riskRoute: groundTruth.expectedRiskRoute,
    evidenceRecords: groundTruth.requiredEvidence.map((type, index) => ({
      type,
      sourceId: type === 'risk' ? 'deterministic-risk-policy' : 'synthetic-fixture',
      sourceVersion: '1.0.0',
      status: 'EXPECTED',
      reasonCode: 'EXPECTED_EVIDENCE',
      occurredAt: evalClock.now().toISOString(),
      referenceId: `eval-evidence-expected-${String(index)}`,
    })),
    automaticCommands,
    trajectory: applyKycEvalReviewHarness({
      scenarioId: 'baseline',
      automaticCommands,
      reviewAction: 'NONE',
    }).trajectory,
    normalizedFieldDigests: groundTruth.expectedNormalizedFieldDigests,
  });
};

export const seedKycEvalDatasets = async (mastra: Mastra) => {
  const listed = await mastra.datasets.list({ page: 0, perPage: 100 });
  const existing = new Map(listed.datasets.map(dataset => [dataset.id, dataset]));
  for (const datasetId of kycEvalDatasetIdSchema.options) {
    const physicalId = kycEvalDatasetId(datasetId);
    const expectedItems = kycEvalManifest.datasets[datasetId].map(scenarioId => {
      const scenario = scenarios.get(scenarioId);
      if (scenario === undefined) throw new Error(`Unknown eval scenario ${scenarioId}`);
      return {
        externalId: scenario.id,
        input: { scenarioId: scenario.id, tags: scenario.tags, scenario: scenario.input },
        groundTruth: scenario.groundTruth,
        scorerIds: kycDatasetScorers[datasetId].map(({ id }) => id),
        metadata: {
          schemaVersion: kycEvalManifest.schemaVersion,
          synthetic: true,
          license: kycEvalManifest.license,
          fixtureDigest: scenario.input.fixtureDigest,
        },
        source: { type: 'json' as const, referenceId: kycEvalManifestDigest },
      };
    });
    const listedDataset = existing.get(physicalId);
    if (listedDataset !== undefined) {
      assertKycEvalDatasetProvenance(physicalId, listedDataset.metadata);
    }
    const dataset =
      listedDataset !== undefined
        ? await mastra.datasets.get({ id: physicalId })
        : await mastra.datasets.create({
            id: physicalId,
            name: datasetId,
            description: `Synthetic KYC ${datasetId} dataset`,
            inputSchema: z
              .object({
                scenarioId: z.string(),
                tags: z.array(z.string()),
                scenario: scenarioInputSchema,
              })
              .strict(),
            groundTruthSchema: kycEvalGroundTruthSchema,
            targetType: 'scorer',
            scorerIds: kycDatasetScorers[datasetId].map(({ id }) => id),
            metadata: {
              schemaVersion: kycEvalManifest.schemaVersion,
              manifestDigest: kycEvalManifestDigest,
              license: kycEvalManifest.license,
              synthetic: true,
              sourceRevision: kycEvalSourceRevision,
              sourceDigest: kycEvalSourceDigest,
            },
          });
    if (listedDataset === undefined) await dataset.addItems({ items: expectedItems });
    // The current Mastra API marks the union-return overload deprecated even with pagination.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const listedItems = await dataset.listItems({ page: 0, perPage: 100 });
    const items = Array.isArray(listedItems) ? listedItems : listedItems.items;
    if (items.length !== expectedItems.length) {
      throw new Error(`Dataset ${physicalId} has stale or divergent item inventory`);
    }
    const actualByExternalId = new Map(items.map(item => [item.externalId, item]));
    for (const expected of expectedItems) {
      const actual = actualByExternalId.get(expected.externalId);
      if (
        actual === undefined ||
        canonicalize(actual.input) !== canonicalize(expected.input) ||
        canonicalize(actual.groundTruth) !== canonicalize(expected.groundTruth) ||
        actual.metadata?.fixtureDigest !== expected.metadata.fixtureDigest
      ) {
        throw new Error(`Dataset ${physicalId} has stale or divergent item inventory`);
      }
    }
  }
};

const ratio = (numerator: number, denominator: number): number => (denominator === 0 ? 1 : numerator / denominator);

export const deterministicKycEvalResultSchema = z
  .object({
    schemaVersion: z.literal('4.0.0'),
    manifestDigest: z.string().regex(/^[a-f0-9]{64}$/u),
    sourceRevision: z.union([z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u), z.literal('unversioned')]),
    sourceDigest: z.string().regex(/^[a-f0-9]{64}$/u),
    scenarios: z.number().int().min(12),
    scores: z.object({
      criticalExtractionFields: z.number().min(0).max(1),
      normalizedExtraction: z.number().min(0).max(1),
      policyAdherence: z.number().min(0).max(1),
      evidenceCompleteness: z.number().min(0).max(1),
      escalationRecall: z.number().min(0).max(1),
      escalationPrecision: z.number().min(0).max(1),
      decisionConsistency: z.number().min(0).max(1),
      requiredTrajectory: z.number().min(0).max(1),
    }),
    passed: z.boolean(),
  })
  .strict();

type KycEvalScoreId = keyof z.infer<typeof deterministicKycEvalResultSchema>['scores'];

export const kycEvalScorePassed = (scoreId: KycEvalScoreId, score: number): boolean => {
  if (scoreId === 'escalationPrecision') return true;
  if (scoreId === 'normalizedExtraction' || scoreId === 'escalationRecall') return score >= 0.95;
  return score === 1;
};

export const runDeterministicKycEval = async (
  candidate: (
    scenarioId: string,
    input: z.infer<typeof scenarioInputSchema>,
  ) => KycEvalOutput | Promise<KycEvalOutput> = executeKycEvalScenario,
) => {
  const sums = {
    criticalExtractionFields: 0,
    normalizedExtraction: 0,
    policyAdherence: 0,
    evidenceCompleteness: 0,
    decisionConsistency: 0,
    requiredTrajectory: 0,
  };
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  for (const scenario of kycEvalManifest.scenarios) {
    const attempts: KycEvalOutput[] = [];
    for (let attempt = 0; attempt < scenario.input.repeatCount; attempt += 1) {
      attempts.push(kycEvalOutputSchema.parse(await candidate(scenario.id, scenario.input)));
    }
    const actual = attempts[0];
    if (actual === undefined) throw new Error(`Eval scenario ${scenario.id} produced no output`);
    const consistent = attempts.every(attempt => canonicalize(attempt) === canonicalize(actual));
    const run = {
      input: { scenarioId: scenario.id },
      output: actual,
      groundTruth: scenario.groundTruth,
    };
    sums.criticalExtractionFields += (await criticalExtractionFieldsScorer.run(run)).score;
    sums.normalizedExtraction += (await normalizedExtractionScorer.run(run)).score;
    sums.policyAdherence += (await policyAdherenceScorer.run(run)).score;
    sums.evidenceCompleteness += (await evidenceCompletenessScorer.run(run)).score;
    sums.decisionConsistency += consistent ? (await decisionConsistencyScorer.run(run)).score : 0;
    sums.requiredTrajectory += (await requiredTrajectoryScorer.run(run)).score;
    let escalated = false;
    try {
      escalated = applyKycEvalReviewHarness({
        scenarioId: scenario.id,
        automaticCommands: actual.automaticCommands,
        reviewAction: scenario.groundTruth.reviewAction,
      }).escalated;
    } catch {
      // Invalid automatic paths are scorer failures, not eval-runner failures.
    }
    if (scenario.groundTruth.requiresEscalation && escalated) truePositive += 1;
    if (!scenario.groundTruth.requiresEscalation && escalated) falsePositive += 1;
    if (scenario.groundTruth.requiresEscalation && !escalated) falseNegative += 1;
  }
  const count = kycEvalManifest.scenarios.length;
  const scores = {
    criticalExtractionFields: ratio(sums.criticalExtractionFields, count),
    normalizedExtraction: ratio(sums.normalizedExtraction, count),
    policyAdherence: ratio(sums.policyAdherence, count),
    evidenceCompleteness: ratio(sums.evidenceCompleteness, count),
    escalationRecall: ratio(truePositive, truePositive + falseNegative),
    escalationPrecision: ratio(truePositive, truePositive + falsePositive),
    decisionConsistency: ratio(sums.decisionConsistency, count),
    requiredTrajectory: ratio(sums.requiredTrajectory, count),
  };
  return deterministicKycEvalResultSchema.parse({
    schemaVersion: '4.0.0',
    manifestDigest: kycEvalManifestDigest,
    sourceRevision: kycEvalSourceRevision,
    sourceDigest: kycEvalSourceDigest,
    scenarios: count,
    scores,
    passed:
      kycEvalScorePassed('criticalExtractionFields', scores.criticalExtractionFields) &&
      kycEvalScorePassed('normalizedExtraction', scores.normalizedExtraction) &&
      kycEvalScorePassed('policyAdherence', scores.policyAdherence) &&
      kycEvalScorePassed('evidenceCompleteness', scores.evidenceCompleteness) &&
      kycEvalScorePassed('escalationRecall', scores.escalationRecall) &&
      kycEvalScorePassed('decisionConsistency', scores.decisionConsistency) &&
      kycEvalScorePassed('requiredTrajectory', scores.requiredTrajectory),
  });
};

export type KycExperimentSummary = Readonly<{ status: string; failedCount: number }>;

export const runMastraKycExperiments = async (
  mastra: Mastra,
  variantId = 'baseline',
): Promise<KycExperimentSummary[]> => {
  await seedKycEvalDatasets(mastra);
  const summaries: KycExperimentSummary[] = [];
  for (const datasetId of kycEvalDatasetIdSchema.options) {
    const dataset = await mastra.datasets.get({ id: kycEvalDatasetId(datasetId) });
    const summary = await dataset.startExperiment<
      {
        scenarioId: string;
        tags: string[];
        scenario: z.infer<typeof scenarioInputSchema>;
      },
      KycEvalOutput,
      KycEvalGroundTruth
    >({
      name: `${datasetId}-${variantId}`,
      description: 'Offline synthetic deterministic KYC quality baseline',
      task: async ({ input }) => {
        const first = await executeKycEvalScenario(input.scenarioId, input.scenario);
        const second = await executeKycEvalScenario(input.scenarioId, input.scenario);
        if (canonicalize(first) !== canonicalize(second)) {
          throw new Error(`Eval scenario ${input.scenarioId} is nondeterministic`);
        }
        return first;
      },
      scorers: [...kycDatasetScorers[datasetId]],
      maxConcurrency: 1,
      maxRetries: 0,
      provenance: {
        source: 'repository',
        sourceId: 'mastra-kyc-evals-v4',
        sourceVersion: `${kycEvalSourceRevision}:${kycEvalManifestDigest}`,
      },
      grouping: {
        experimentSetId: `kyc-quality-v4-${kycEvalManifestDigest.slice(0, 12)}`,
        comparisonId: `deterministic-${kycEvalSourceRevision.slice(0, 12)}`,
        variantId,
        trialIndex: 0,
      },
      metadata: {
        manifestDigest: kycEvalManifestDigest,
        sourceRevision: kycEvalSourceRevision,
        sourceDigest: kycEvalSourceDigest,
        synthetic: true,
      },
    });
    summaries.push({ status: summary.status, failedCount: summary.failedCount });
  }
  return summaries;
};
