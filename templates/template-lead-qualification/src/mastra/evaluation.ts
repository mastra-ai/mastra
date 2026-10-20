import { createHash } from 'node:crypto';
import { z } from 'zod';
import { businessModelLabelSchema, outcomes } from './config/qualification';
import {
  assessmentSchema,
  employeeIntervalSchema,
  factSchema,
  identitySchema,
  signalSchema,
} from './research/contracts';
import { scoreCompany } from './tools/score-company';
import { approvedUrl } from './research/page-retrieval';
import { modelLabelsSchema, modelAttributeMatches } from './model-evaluation-data';

const attributeLabel = z
  .strictObject({ disposition: factSchema.shape.disposition, value: factSchema.shape.value })
  .refine(value => value.disposition !== 'accepted' || value.value !== null, 'Accepted labels require a value');
const identityLabel = z
  .strictObject({ status: identitySchema.shape.status, domain: identitySchema.shape.domain })
  .refine(value => value.status !== 'resolved' || value.domain !== null, 'Resolved labels require a company domain');
export const evaluationLabelsSchema = z
  .strictObject({
    version: z.literal(1),
    profilesDigest: z.string().regex(/^[a-f0-9]{64}$/),
    datasetId: z.string().min(1).max(100),
    provenance: z.string().min(1).max(2000),
    policyVersion: z.string().min(1).max(100),
    cases: z
      .array(
        z.strictObject({
          id: z.string().min(1).max(100),
          identity: identityLabel,
          attributes: z.strictObject({
            businessModel: attributeLabel.safeExtend({ value: businessModelLabelSchema.nullable() }),
            employeeCount: attributeLabel.safeExtend({ value: employeeIntervalSchema.nullable() }),
            headquartersCountry: attributeLabel.safeExtend({
              value: z
                .string()
                .regex(/^[A-Z]{2}$/)
                .nullable(),
            }),
            buyingIntent: attributeLabel.safeExtend({ value: z.array(signalSchema).nullable() }),
          }),
          classification: z.enum(outcomes),
          score: z.number().int().min(0).max(100),
          disqualifiers: z.array(z.enum(['businessModel', 'employeeCount', 'headquartersCountry'])).max(3),
        }),
      )
      .min(20)
      .max(1000),
  })
  .refine(value => new Set(value.cases.map(item => item.id)).size === value.cases.length, 'Case IDs must be unique');
export const qualificationEvaluationLabelsSchema = z.union([evaluationLabelsSchema, modelLabelsSchema]);
export const evaluationInputSchema = z
  .strictObject({
    datasetDigest: z.string().regex(/^[a-f0-9]{64}$/),
    profilesDigest: z.string().regex(/^[a-f0-9]{64}$/),
    mode: z.enum(['controlled_functional', 'live_model']),
    collection: z
      .strictObject({
        executionId: z.uuid(),
        approvalDigest: z.string().regex(/^[a-f0-9]{64}$/),
        sourceRevision: z.string().regex(/^[a-f0-9]{40}$/),
        sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
        configurationDigest: z.string().regex(/^[a-f0-9]{64}$/),
        promptsDigest: z.string().regex(/^[a-f0-9]{64}$/),
        model: z.literal('openai/gpt-6-luna'),
        requestsReserved: z.number().int().min(0).max(120),
        confirmedTransportAttempts: z.number().int().min(0).max(120),
        responseCount: z.number().int().min(0).max(120),
        outputTokensReserved: z.number().int().min(0).max(240000),
        bytesReserved: z.number().int().min(0).max(15728640).optional(),
        costReservedNanoUsd: z.number().int().min(0).max(5000000000).optional(),
        costCeilingNanoUsd: z.number().int().min(1).max(5000000000).optional(),
        failureCode: z
          .string()
          .regex(/^model_collection_[a-z_]{1,100}$/)
          .nullable()
          .optional(),
        observedInputTokens: z.number().int().nonnegative().nullable(),
        observedOutputTokens: z.number().int().nonnegative().nullable(),
        knownInputTokensSubtotal: z.number().int().nonnegative(),
        knownOutputTokensSubtotal: z.number().int().nonnegative(),
        caseRequests: z.record(z.string(), z.number().int().min(0).max(6)),
      })
      .superRefine((value, context) => {
        const fields = [value.bytesReserved, value.costReservedNanoUsd, value.costCeilingNanoUsd, value.failureCode];
        const present = fields.filter(field => field !== undefined).length;
        if (
          (present !== 0 && present !== fields.length) ||
          (value.costReservedNanoUsd !== undefined &&
            value.costCeilingNanoUsd !== undefined &&
            value.costReservedNanoUsd > value.costCeilingNanoUsd) ||
          (value.bytesReserved !== undefined && value.bytesReserved > value.requestsReserved * 131072)
        )
          context.addIssue({
            code: 'custom',
            message: 'Collection currency reservations must be complete and bounded',
          });
      })
      .optional(),
    observations: z.array(z.strictObject({ id: z.string().min(1).max(100), assessment: assessmentSchema })).max(1000),
    semanticReviews: z
      .array(
        z.strictObject({
          id: z.string().min(1).max(100),
          reviewer: z.string().trim().min(1).max(100),
          summaryDigest: z.string().regex(/^[a-f0-9]{64}$/),
          unsupportedDecisiveClaims: z.array(z.string().min(1).max(500)).max(20),
          allUnsupportedClaimsFlagged: z.boolean(),
        }),
      )
      .max(1000),
  })
  .refine(
    value =>
      new Set(value.observations.map(item => item.id)).size === value.observations.length &&
      new Set(value.semanticReviews.map(item => item.id)).size === value.semanticReviews.length,
    'Observations and reviews must have unique case IDs',
  );
export const textDigest = (value: string) => createHash('sha256').update(value).digest('hex');
const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

/** Imported observations keep frozen expectations separate from model/provider execution. */
export function evaluateQualification(labelText: string, input: z.input<typeof evaluationInputSchema>) {
  const labels = qualificationEvaluationLabelsSchema.parse(JSON.parse(labelText));
  const run = evaluationInputSchema.parse(input);
  if (textDigest(labelText) !== run.datasetDigest || run.profilesDigest !== labels.profilesDigest)
    throw new Error('evaluation_dataset_digest_mismatch');
  if (
    (labels.version === 1 && run.mode !== 'controlled_functional') ||
    (labels.version === 2 && (run.mode !== 'live_model' || !run.collection))
  )
    throw new Error('evaluation_dataset_mode_mismatch');
  if (run.observations.some(item => !labels.cases.some(label => label.id === item.id)))
    throw new Error('evaluation_unknown_case');
  const dimensions = new Map<
    string,
    { target: number; numerator: number; denominator: number; failures: Array<{ id: string; reason: string }> }
  >([
    ['identity', { target: 0.95, numerator: 0, denominator: 0, failures: [] }],
    ['attributeExtraction', { target: 0.95, numerator: 0, denominator: 0, failures: [] }],
    ...['classification', 'disqualifiers', 'scoreConsistency', 'evidenceReferences', 'unsupportedClaims'].map(
      name =>
        [
          name,
          { target: 1, numerator: 0, denominator: 0, failures: [] as Array<{ id: string; reason: string }> },
        ] as const,
    ),
  ]);
  function record(name: string, id: string, passed: boolean, reason: string) {
    const dimension = dimensions.get(name)!;
    dimension.denominator++;
    if (passed) dimension.numerator++;
    else dimension.failures.push({ id, reason });
  }
  const unsupportedAccepted: Array<{ id: string; attribute: string }> = [];
  const cases = labels.cases.map(label => {
    const assessment = run.observations.find(item => item.id === label.id)?.assessment;
    if (!assessment) {
      for (const name of ['identity', 'classification', 'scoreConsistency', 'unsupportedClaims'])
        record(name, label.id, false, 'missing_observation');
      record('unsupportedClaims', `${label.id}:facts`, false, 'missing_observation');
      for (const attribute of Object.keys(label.attributes))
        record('attributeExtraction', `${label.id}:${attribute}`, false, 'missing_observation');
      for (const rule of label.disqualifiers)
        record('disqualifiers', `${label.id}:${rule}`, false, 'missing_observation');
      dimensions.get('evidenceReferences')!.failures.push({ id: label.id, reason: 'missing_observation' });
      return { id: label.id, status: 'missing' };
    }
    record(
      'identity',
      label.id,
      equal({ status: assessment.identity.status, domain: assessment.identity.domain }, label.identity),
      'identity_differs',
    );
    const attributeResults = [];
    for (const [attribute, expected] of Object.entries(label.attributes)) {
      const fact = assessment.facts[attribute as keyof typeof assessment.facts];
      const matched =
        'match' in expected
          ? modelAttributeMatches(expected, fact)
          : equal({ disposition: fact.disposition, value: fact.value }, expected);
      attributeResults.push({ attribute, actual: { disposition: fact.disposition, value: fact.value }, matched });
      if (fact.disposition === 'accepted' && !matched) unsupportedAccepted.push({ id: label.id, attribute });
      record('attributeExtraction', `${label.id}:${attribute}`, matched, 'attribute_differs');
    }
    record(
      'classification',
      label.id,
      assessment.result.classification === label.classification,
      'classification_differs',
    );
    const actualDisqualifiers = assessment.result.contributions
      .filter(rule => rule.state === 'mismatched')
      .map(rule => rule.rule);
    for (const rule of label.disqualifiers)
      record('disqualifiers', `${label.id}:${rule}`, actualDisqualifiers.includes(rule), 'missed_disqualifier');
    for (const rule of actualDisqualifiers)
      if (!label.disqualifiers.includes(rule as (typeof label.disqualifiers)[number]))
        dimensions.get('disqualifiers')!.failures.push({ id: label.id, reason: `unexpected_disqualifier:${rule}` });
    const repeated = scoreCompany({
      identity: assessment.identity,
      facts: assessment.facts,
      policy: assessment.snapshot.config.policy,
      routing: assessment.snapshot.config.routing,
      assessmentTime: assessment.snapshot.assessmentTime,
    });
    record(
      'scoreConsistency',
      label.id,
      assessment.snapshot.config.policy.version === labels.policyVersion &&
        assessment.result.score === label.score &&
        equal(assessment.result, repeated),
      'score_or_policy_differs',
    );
    const sources = new Map(assessment.evidence.map(source => [source.id, source]));
    const references = Object.values(assessment.facts).flatMap(fact => fact.evidenceIds);
    for (const id of references) {
      const source = sources.get(id);
      let valid = Boolean(source);
      try {
        if (source?.kind === 'website')
          approvedUrl(source.source, [
            ...(assessment.identity.domain ? [assessment.identity.domain] : []),
            ...assessment.snapshot.config.sources.additionalDomains,
          ]);
      } catch {
        valid = false;
      }
      record('evidenceReferences', `${label.id}:${id}`, valid, 'invalid_reference');
    }
    if (!references.length && label.identity.status === 'resolved')
      dimensions
        .get('evidenceReferences')!
        .failures.push({ id: label.id, reason: 'no_references_for_resolved_company' });
    record(
      'unsupportedClaims',
      `${label.id}:facts`,
      !unsupportedAccepted.some(item => item.id === label.id),
      'unsupported_fact_accepted',
    );
    const review = run.semanticReviews.find(item => item.id === label.id);
    record(
      'unsupportedClaims',
      label.id,
      Boolean(
        review &&
        review.summaryDigest === textDigest(assessment.summary) &&
        (!review.unsupportedDecisiveClaims.length || review.allUnsupportedClaimsFlagged),
      ),
      review ? 'unflagged_claim_or_stale_review' : 'manual_semantic_review_required',
    );
    return {
      id: label.id,
      status: 'observed',
      model: assessment.snapshot.model,
      policyVersion: assessment.snapshot.config.policy.version,
      snapshotDigest: assessment.snapshot.digest,
      promptsDigest: textDigest(JSON.stringify(assessment.snapshot.config.prompts)),
      summaryDigest: textDigest(assessment.summary),
      attributeResults,
      modelRequests: run.collection?.caseRequests[label.id] ?? null,
    };
  });
  const metrics = Object.fromEntries(
    [...dimensions].map(([name, value]) => [
      name,
      {
        ...value,
        rate: value.denominator ? value.numerator / value.denominator : null,
        passed:
          value.denominator > 0 &&
          value.numerator / value.denominator >= value.target &&
          (value.target < 1 || value.failures.length === 0),
      },
    ]),
  );
  return {
    datasetId: labels.datasetId,
    datasetDigest: run.datasetDigest,
    provenance: labels.provenance,
    mode: run.mode,
    profilesDigest: run.profilesDigest,
    collection: run.collection ?? null,
    populations:
      labels.version === 2
        ? {
            labeledIdentityDecisions: 24,
            plannedDomainResearchCases: labels.cases.filter(item => item.population === 'domain').length,
            labeledFirmographicOpportunities: labels.cases.filter(item => item.population === 'domain').length * 3,
            deterministicSubmittedIntentDecisions: labels.cases.filter(item => item.population === 'domain').length,
            deterministicMissingDecisions: labels.cases.filter(item => item.population !== 'domain').length * 4,
            emailOnlyWithoutResearch: labels.cases.filter(item => item.population === 'email').length,
            crmOnlyWithoutResearch: labels.cases.filter(item => item.population === 'crm').length,
            observedCases: run.observations.length,
            confirmedTransportAttempts: run.collection?.confirmedTransportAttempts ?? null,
          }
        : null,
    observationsDigest: textDigest(JSON.stringify(run.observations)),
    sampleCount: labels.cases.length,
    cases: cases.map(item => ({
      ...item,
      failures: [...dimensions].flatMap(([dimension, value]) =>
        value.failures
          .filter(failure => failure.id === item.id || failure.id.startsWith(`${item.id}:`))
          .map(failure => ({ dimension, reason: failure.reason })),
      ),
    })),
    dimensions: metrics,
    unsupportedAccepted,
    targetsMet:
      run.observations.length === labels.cases.length &&
      unsupportedAccepted.length === 0 &&
      Object.values(metrics).every(value => value.passed),
    qualityClaim:
      run.mode === 'controlled_functional'
        ? 'controlled_functionality_only'
        : 'curated_set_only_not_production_accuracy',
  };
}
