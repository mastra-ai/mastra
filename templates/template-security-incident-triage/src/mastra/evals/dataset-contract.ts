import { createHash } from 'node:crypto';

import { z } from 'zod';

export const SecurityEvalSeveritySchema = z.enum(['low', 'medium', 'high']);
export const SecurityEvalDispositionSchema = z.enum(['classified', 'manual-review']);
const scenarioSchema = z.enum(['privilege', 'country', 'device']);
const splitSchema = z.enum(['train', 'dev', 'test']);
const hexSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const authorizationTargetClasses = {
  privilege: ['role-assignment', 'group-membership', 'emergency-access'],
  country: ['browser-session', 'service-token', 'federated-session'],
  device: ['managed-endpoint', 'registered-browser', 'recovery-device'],
} as const;
const approvalBases = [
  'runbook-scope',
  'tenant-policy',
  'incident-evidence',
  'actor-scope',
  'session-scope',
  'provider-verification',
] as const;
export const SecurityEvalRequiredVectors = [
  'partial',
  'absent',
  'contradictory',
  'tampered',
  'cross-tenant',
  'cross-incident',
  'cross-run',
  'stale-evidence',
  'webhook-duplicate',
  'webhook-out-of-order',
  'runbook-missing',
  'runbook-inactive',
  'runbook-version-mismatch',
  'runbook-chunk-mismatch',
  'provider-unavailable',
  'provider-retry',
  'provider-partial-failure',
  'approval-approved',
  'approval-absent',
  'approval-expired',
  'approval-duplicate',
  'approval-rejected',
  'approval-cross-tenant',
  'approval-stale-hash',
  'prompt-injection-alert',
  'prompt-injection-runbook',
  'prompt-injection-provider',
  'outside-allowlist',
  'target-mismatch',
  'containment-verified',
  'containment-not-executed',
  'containment-blocked',
] as const;
const vectorSchema = z.enum(SecurityEvalRequiredVectors);

export const SecurityEvalInputSchema = z
  .object({
    caseId: z.string().regex(/^security-v1-(privilege|country|device)-\d{2}$/u),
    scenario: scenarioSchema,
    split: splitSchema,
    tags: z.array(z.string()).min(7),
    fixture: z
      .object({
        tenantAlias: z.string().regex(/^tenant-[abc]$/u),
        incidentAlias: z.string().regex(/^incident-[a-z]+-\d{2}$/u),
        alert: z
          .object({
            kind: z.enum(['unauthorized_privilege_change', 'disallowed_country_login', 'unknown_device_login']),
            signal: z.string().min(1),
            untrustedContent: z.string().nullable(),
            sequence: z.number().int().positive(),
          })
          .strict(),
        facts: z
          .array(
            z
              .object({
                // triage fact types preserve their production camel-case suffixes
                // (for example `login.ipPresent`).
                key: z.string().regex(/^[a-z]+\.[A-Za-z_]+$/u),
                value: z.string().min(1),
                source: z.enum(['identity', 'cloud', 'endpoint']),
                provider: z.string().min(1),
                confidenceProvenance: z.enum(['provider', 'rule-v1', 'policy-v1']),
                confidence: z.number().min(0).max(1),
              })
              .strict(),
          )
          .min(3),
        evidence: z
          .object({
            state: z.enum(['complete', 'partial', 'missing', 'contradictory', 'tampered']),
            reference: z.string().min(1),
            hash: hexSchema,
            scope: z.enum(['same-run', 'cross-tenant', 'cross-incident', 'cross-run', 'stale']),
            ownerTenantAlias: z.string().regex(/^tenant-[abc]$/u),
            ownerIncidentAlias: z.string().regex(/^incident-[a-z]+-\d{2}$/u),
            ownerRunAlias: z.string().min(1),
          })
          .strict(),
        runbook: z
          .object({
            id: z.string().min(1),
            version: z.string().min(1),
            active: z.boolean(),
            availability: z.enum(['present', 'missing']),
            hash: hexSchema,
            chunkHash: hexSchema,
            untrustedContent: z.string().nullable(),
          })
          .strict(),
        approval: z.enum(['approved', 'rejected', 'expired', 'absent', 'cross-tenant', 'duplicate', 'stale-hash']),
        delivery: z.enum(['normal', 'duplicate', 'out-of-order']),
        provider: z
          .object({
            state: z.enum(['available', 'unavailable', 'retry', 'partial-failure']),
            untrustedContent: z.string().nullable(),
          })
          .strict(),
        plan: z
          .object({
            request: z.enum(['runbook-operation', 'outside-allowlist']),
            target: z.enum(['matched', 'mismatched']),
            hash: z.enum(['fresh', 'stale']),
            // Concrete authorization dimensions, distinct from opaque target
            // IDs and from the severity policy's output label.
            targetClass: z.string().min(1),
            approvalBasis: z.string().min(1),
          })
          .strict(),
        containment: z.enum(['executed-verified', 'not-executed', 'blocked']),
        vectors: z.array(vectorSchema).min(1),
      })
      .strict(),
  })
  .strict();

export const SecurityEvalExpectedSchema = z
  .object({
    caseId: SecurityEvalInputSchema.shape.caseId,
    severity: SecurityEvalSeveritySchema.optional(),
    disposition: SecurityEvalDispositionSchema,
    mandatoryRules: z.array(z.string()),
    requiredClaimIds: z.array(z.string()),
    allowlistedActions: z.array(z.string()),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.disposition === 'classified' && !value.severity)
      context.addIssue({
        code: 'custom',
        message: 'classified cases require severity',
      });
    if (value.disposition === 'manual-review' && value.severity)
      context.addIssue({
        code: 'custom',
        message: 'manual-review cannot include severity',
      });
    if (value.disposition === 'manual-review' && (value.requiredClaimIds.length || value.allowlistedActions.length))
      context.addIssue({
        code: 'custom',
        message: 'manual-review cannot authorize a plan',
      });
  });

export const SecurityEvalManifestSchema = z
  .object({
    datasetVersion: z.literal('security-eval-dataset-v1'),
    schemaVersion: z.literal(1),
    createdAt: z.literal('2026-08-30T00:00:00.000Z'),
    seed: z.literal('security-eval-v1-offline-seed'),
    clock: z.literal('2026-08-30T00:00:00.000Z'),
    modelId: z.literal('openai/gpt-4o-mini'),
    promptLabel: z.literal('security-eval-offline-replay-v1'),
    approvedBy: z.string().nullable(),
    approvedAt: z.string().nullable(),
    approvalStatus: z.enum(['pending', 'approved']),
    hashes: z.object({
      inputs: hexSchema,
      expected: hexSchema,
      manifest: hexSchema,
    }),
    provenance: z
      .object({
        authors: z.array(z.string()).min(1),
        independentReviewers: z.array(z.string()),
        originCommit: z.string().regex(/^[a-f0-9]{40}$/u),
        promptHash: hexSchema,
        promptPath: z.literal('src/mastra/agents/response-planner.ts'),
        runbooks: z.array(z.object({ id: z.string(), version: z.string(), hash: hexSchema }).strict()).min(3),
        replayPath: z.literal('src/mastra/evals/offline-replay.ts'),
        replayHash: hexSchema,
        changePolicy: z.literal('new-version-review-and-diego-approval-before-observed-run'),
        changelog: z.literal('CHANGELOG.md'),
      })
      .strict(),
    tagRegistry: z.array(z.string()).min(31),
    counts: z
      .object({
        cases: z.literal(72),
        train: z.literal(36),
        dev: z.literal(12),
        test: z.literal(24),
        classified: z.literal(54),
        manualReview: z.literal(18),
        scenarios: z.object({
          privilege: z.literal(24),
          country: z.literal(24),
          device: z.literal(24),
        }),
        labels: z.object({
          low: z.literal(18),
          medium: z.literal(18),
          high: z.literal(18),
        }),
      })
      .strict(),
    coverage: z
      .object({
        vectors: z.record(z.string(), z.number().int().positive()),
        byScenario: z.record(scenarioSchema, z.object({ classified: z.literal(18), manualReview: z.literal(6) })),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    const approved = value.approvalStatus === 'approved';
    if (approved !== (value.approvedBy === 'Diego' && value.approvedAt !== null))
      context.addIssue({
        code: 'custom',
        message: 'approval fields do not match approval status',
      });
    if (approved && value.provenance.independentReviewers.length === 0)
      context.addIssue({
        code: 'custom',
        message: 'approved dataset requires independent reviewers',
      });
  });

export type SecurityEvalInput = z.infer<typeof SecurityEvalInputSchema>;
export type SecurityEvalExpected = z.infer<typeof SecurityEvalExpectedSchema>;
export type SecurityEvalManifest = z.infer<typeof SecurityEvalManifestSchema>;
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}
export function sha256Canonical(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}
export function sha256Text(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, sortValue(nested)]),
    );
  return value;
}
function manifestHashInput(manifest: SecurityEvalManifest): unknown {
  const hashes = {
    inputs: manifest.hashes.inputs,
    expected: manifest.hashes.expected,
  };
  return { ...manifest, hashes };
}
export function assertDatasetContract(input: {
  manifest: unknown;
  inputs: readonly unknown[];
  expected: readonly unknown[];
  inputText: string;
  expectedText: string;
}): Readonly<{
  manifest: SecurityEvalManifest;
  inputs: readonly SecurityEvalInput[];
  expected: readonly SecurityEvalExpected[];
}> {
  const manifest = SecurityEvalManifestSchema.parse(input.manifest);
  const inputs = input.inputs.map(entry => SecurityEvalInputSchema.parse(entry));
  const expected = input.expected.map(entry => SecurityEvalExpectedSchema.parse(entry));
  if (
    sha256Text(input.inputText) !== manifest.hashes.inputs ||
    sha256Text(input.expectedText) !== manifest.hashes.expected ||
    sha256Canonical(manifestHashInput(manifest)) !== manifest.hashes.manifest
  )
    throw new Error('SECURITY_EVAL_DATASET_HASH_INVALID');
  if (inputs.length !== 72 || expected.length !== 72) throw new Error('SECURITY_EVAL_DATASET_COUNT_INVALID');
  const ids = new Set(inputs.map(entry => entry.caseId));
  if (ids.size !== 72 || expected.length !== ids.size || expected.some(entry => !ids.has(entry.caseId)))
    throw new Error('SECURITY_EVAL_DATASET_ID_INVALID');
  const byId = new Map(inputs.map(entry => [entry.caseId, entry]));
  for (const entry of expected) {
    const item = byId.get(entry.caseId);
    if (!item || entry.caseId.split('-')[2] !== item.scenario)
      throw new Error('SECURITY_EVAL_DATASET_SCENARIO_INVALID');
    if (
      entry.disposition === 'classified' &&
      (!item.fixture.runbook.active ||
        item.fixture.runbook.availability !== 'present' ||
        ['missing', 'tampered'].includes(item.fixture.evidence.state) ||
        item.fixture.evidence.scope !== 'same-run' ||
        item.fixture.approval !== 'approved' ||
        item.fixture.delivery !== 'normal' ||
        item.fixture.provider.state !== 'available' ||
        item.fixture.plan.request !== 'runbook-operation' ||
        item.fixture.plan.target !== 'matched' ||
        item.fixture.plan.hash !== 'fresh' ||
        item.fixture.containment !== 'executed-verified')
    )
      throw new Error('SECURITY_EVAL_DATASET_FAIL_CLOSED_INVALID');
    if (entry.disposition === 'manual-review' && entry.mandatoryRules.length !== 0)
      throw new Error('SECURITY_EVAL_DATASET_MANUAL_REVIEW_INVALID');
  }
  const semantic = new Map<string, string>();
  for (const item of inputs) {
    const recomputedEvidenceHash = sha256Canonical(item.fixture.facts);
    if (recomputedEvidenceHash !== item.fixture.evidence.hash)
      throw new Error('SECURITY_EVAL_DATASET_EVIDENCE_HASH_INVALID');
    const contentHash = policyNormalizedSignature(item);
    const existingSplit = semantic.get(contentHash);
    if (existingSplit) throw new Error('SECURITY_EVAL_DATASET_LEAKAGE_INVALID');
    semantic.set(contentHash, item.split);
    if (!hasValidAuthorizationFamily(item)) throw new Error('SECURITY_EVAL_DATASET_PLAN_BINDING_INVALID');
    const currentRunAlias = `offline-${item.caseId}`;
    const owner = item.fixture.evidence;
    if (
      (owner.scope === 'same-run' &&
        (owner.ownerTenantAlias !== item.fixture.tenantAlias ||
          owner.ownerIncidentAlias !== item.fixture.incidentAlias ||
          owner.ownerRunAlias !== currentRunAlias)) ||
      (owner.scope === 'cross-tenant' &&
        (owner.ownerTenantAlias === item.fixture.tenantAlias ||
          owner.ownerIncidentAlias !== item.fixture.incidentAlias ||
          owner.ownerRunAlias !== currentRunAlias)) ||
      (owner.scope === 'cross-incident' &&
        (owner.ownerTenantAlias !== item.fixture.tenantAlias ||
          owner.ownerIncidentAlias === item.fixture.incidentAlias ||
          owner.ownerRunAlias !== currentRunAlias)) ||
      (owner.scope === 'cross-run' &&
        (owner.ownerTenantAlias !== item.fixture.tenantAlias ||
          owner.ownerIncidentAlias !== item.fixture.incidentAlias ||
          owner.ownerRunAlias === currentRunAlias)) ||
      (owner.scope === 'stale' &&
        (owner.ownerTenantAlias !== item.fixture.tenantAlias ||
          owner.ownerIncidentAlias !== item.fixture.incidentAlias ||
          owner.ownerRunAlias === currentRunAlias))
    )
      throw new Error('SECURITY_EVAL_DATASET_EVIDENCE_SCOPE_INVALID');
    if (!item.tags.every(tag => manifest.tagRegistry.includes(tag)))
      throw new Error('SECURITY_EVAL_DATASET_TAG_INVALID');
    if (new Set(item.tags).size !== item.tags.length) throw new Error('SECURITY_EVAL_DATASET_TAG_DUPLICATE');
    if (
      item.tags.some(
        tag =>
          !tag.startsWith('scenario:') &&
          !tag.startsWith('evidence:') &&
          !tag.startsWith('approval:') &&
          !tag.startsWith('scope:') &&
          !tag.startsWith('runbook:') &&
          !tag.startsWith('alert:') &&
          !tag.startsWith('vector:'),
      )
    )
      throw new Error('SECURITY_EVAL_DATASET_TAG_SEMANTICS_INVALID');
    const requiredTags = [
      `scenario:${item.scenario}`,
      `evidence:${item.fixture.evidence.state}`,
      `approval:${item.fixture.approval}`,
      `scope:${item.fixture.evidence.scope}`,
      `runbook:${item.fixture.runbook.active ? 'active' : 'inactive'}`,
      `alert:${item.fixture.alert.kind}`,
      ...materializedVectors(item).map(vector => `vector:${vector}`),
    ];
    if (
      !requiredTags.every(tag => item.tags.includes(tag)) ||
      !item.tags.filter(tag => tag.startsWith('vector:')).every(tag => materializedVectors(item).includes(tag.slice(7)))
    )
      throw new Error('SECURITY_EVAL_DATASET_TAG_DERIVATION_INVALID');
  }
  const counts = {
    train: 0,
    dev: 0,
    test: 0,
    classified: 0,
    manualReview: 0,
    privilege: 0,
    country: 0,
    device: 0,
    low: 0,
    medium: 0,
    high: 0,
  };
  for (const item of inputs) {
    counts[item.split]++;
    counts[item.scenario]++;
  }
  for (const entry of expected)
    if (entry.disposition === 'classified') {
      counts.classified++;
      counts[entry.severity!]++;
    } else counts.manualReview++;
  if (
    counts.train !== 36 ||
    counts.dev !== 12 ||
    counts.test !== 24 ||
    counts.classified !== 54 ||
    counts.manualReview !== 18 ||
    counts.privilege !== 24 ||
    counts.country !== 24 ||
    counts.device !== 24 ||
    counts.low !== 18 ||
    counts.medium !== 18 ||
    counts.high !== 18
  )
    throw new Error('SECURITY_EVAL_DATASET_DISTRIBUTION_INVALID');
  const coverage = manifest.coverage;
  const observedVectors = new Map<string, number>();
  for (const item of inputs)
    for (const vector of materializedVectors(item)) observedVectors.set(vector, (observedVectors.get(vector) ?? 0) + 1);
  if (
    Object.values(coverage.byScenario).some(entry => entry.classified !== 18 || entry.manualReview !== 6) ||
    SecurityEvalRequiredVectors.some(vector => coverage.vectors[vector] !== observedVectors.get(vector)) ||
    Object.keys(coverage.vectors).length !== SecurityEvalRequiredVectors.length
  )
    throw new Error('SECURITY_EVAL_DATASET_COVERAGE_INVALID');
  return Object.freeze({
    manifest,
    inputs: Object.freeze(inputs),
    expected: Object.freeze(expected),
  });
}

/**
 * Signature used for anti-leakage. It intentionally excludes case IDs, alert
 * prose, aliases, references and opaque hashes. Every retained value is read
 * by the triage policy or by the fail-closed replay controls.
 */
export function policyNormalizedSignature(input: SecurityEvalInput): string {
  return sha256Canonical({
    scenario: input.scenario,
    alertKind: input.fixture.alert.kind,
    facts: [...input.fixture.facts]
      .map(({ key, value, source, provider, confidenceProvenance }) => ({
        key,
        value,
        source,
        provider,
        confidenceProvenance,
      }))
      .sort((left, right) => left.key.localeCompare(right.key)),
    evidence: {
      state: input.fixture.evidence.state,
      scope: input.fixture.evidence.scope,
    },
    runbook: {
      availability: input.fixture.runbook.availability,
      active: input.fixture.runbook.active,
      version: input.fixture.runbook.version,
      hash: input.fixture.runbook.hash,
      chunkHash: input.fixture.runbook.chunkHash,
    },
    approval: input.fixture.approval,
    delivery: input.fixture.delivery,
    provider: input.fixture.provider.state,
    plan: input.fixture.plan,
    containment: input.fixture.containment,
    injections: {
      alert: input.fixture.alert.untrustedContent !== null,
      runbook: input.fixture.runbook.untrustedContent !== null,
      provider: input.fixture.provider.untrustedContent !== null,
    },
  });
}

/** Operational approval facts: no opaque IDs may define an eval family. */
export function hasValidAuthorizationFamily(input: SecurityEvalInput): boolean {
  return (
    authorizationTargetClasses[input.scenario].includes(input.fixture.plan.targetClass as never) &&
    (approvalBases as readonly string[]).includes(input.fixture.plan.approvalBasis)
  );
}

export function materializedVectors(input: SecurityEvalInput): readonly string[] {
  const vectors = deriveMaterializedVectors(input);
  if (
    vectors.length !== input.fixture.vectors.length ||
    input.fixture.vectors.some(vector => !vectors.includes(vector))
  )
    throw new Error('SECURITY_EVAL_DATASET_VECTOR_MATERIALIZATION_INVALID');
  return vectors;
}

export function deriveMaterializedVectors(
  input: Omit<SecurityEvalInput, 'fixture'> & {
    fixture: Omit<SecurityEvalInput['fixture'], 'vectors'>;
  },
): readonly string[] {
  const vectors = new Set<string>();
  const fixture = input.fixture;
  if (fixture.evidence.state === 'partial') vectors.add('partial');
  if (fixture.evidence.state === 'missing') vectors.add('absent');
  if (fixture.evidence.state === 'contradictory') vectors.add('contradictory');
  if (fixture.evidence.state === 'tampered') vectors.add('tampered');
  if (fixture.evidence.scope !== 'same-run')
    vectors.add(fixture.evidence.scope === 'stale' ? 'stale-evidence' : fixture.evidence.scope);
  if (fixture.delivery === 'duplicate') vectors.add('webhook-duplicate');
  if (fixture.delivery === 'out-of-order') vectors.add('webhook-out-of-order');
  if (fixture.runbook.availability === 'missing') vectors.add('runbook-missing');
  if (!fixture.runbook.active) vectors.add('runbook-inactive');
  if (fixture.runbook.version !== '1.0.0') vectors.add('runbook-version-mismatch');
  if (fixture.runbook.chunkHash !== fixture.runbook.hash) vectors.add('runbook-chunk-mismatch');
  if (fixture.provider.state !== 'available') vectors.add(`provider-${fixture.provider.state}`);
  vectors.add(`approval-${fixture.approval}`);
  if (fixture.alert.untrustedContent) vectors.add('prompt-injection-alert');
  if (fixture.runbook.untrustedContent) vectors.add('prompt-injection-runbook');
  if (fixture.provider.untrustedContent) vectors.add('prompt-injection-provider');
  if (fixture.plan.request === 'outside-allowlist') vectors.add('outside-allowlist');
  if (fixture.plan.target === 'mismatched') vectors.add('target-mismatch');
  vectors.add(
    fixture.containment === 'executed-verified'
      ? 'containment-verified'
      : fixture.containment === 'not-executed'
        ? 'containment-not-executed'
        : 'containment-blocked',
  );
  return Object.freeze([...vectors].sort());
}
