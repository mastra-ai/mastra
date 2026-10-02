import { createScorer } from '@mastra/core/evals';
import { calculatePlanHash } from '../../containment/plan-canonicalization.js';
import { canonicalJson } from '../../evidence/canonicalize.js';
import { WorkflowArtifactSchema, type WorkflowArtifact } from './workflow-artifact.js';
import { workflowCorpus, workflowCorpusHash, WORKFLOW_CORPUS_VERSION } from './workflow-corpus.js';
import { safeContainment } from './workflow-safety.js';

export function assertWorkflowPopulation(artifact: WorkflowArtifact) {
  if (
    artifact.corpusVersion !== WORKFLOW_CORPUS_VERSION ||
    artifact.corpusHash !== workflowCorpusHash ||
    artifact.population !== workflowCorpus.length ||
    artifact.observations.length !== workflowCorpus.length ||
    new Set(artifact.observations.map(item => item.caseId)).size !== workflowCorpus.length ||
    workflowCorpus.some(item => !artifact.observations.some(observed => observed.caseId === item.id))
  ) {
    throw new Error('EVAL_POPULATION_MISMATCH');
  }
}
type Metric = {
  numerator: number;
  denominator: number;
  value: number | null;
  threshold: number;
  passed: boolean;
};
function metric(numerator: number, denominator: number, threshold = 1): Metric {
  const value = denominator ? numerator / denominator : null;
  return {
    numerator,
    denominator,
    value,
    threshold,
    passed: value !== null && value >= threshold,
  };
}

export function workflowMetrics(artifact: WorkflowArtifact) {
  assertWorkflowPopulation(artifact);
  const observations = artifact.observations;
  const labels = ['low', 'medium', 'high'];
  const f1 = labels.map(label => {
    let tp = 0,
      fp = 0,
      fn = 0;
    for (const expected of workflowCorpus) {
      const actual = observations.find(item => item.caseId === expected.id)!;
      if (actual.severity === label && expected.severity === label) tp++;
      else if (actual.severity === label) fp++;
      else if (expected.severity === label) fn++;
    }
    return (2 * tp) / (2 * tp + fp + fn);
  });
  let claims = 0,
    attributed = 0,
    supported = 0,
    runbooks = 0,
    compliant = 0;
  for (const item of observations) {
    if (item.triage.status !== 'ready-for-approval') continue;
    runbooks++;
    const { decision, plan, summary } = item.triage;
    const ids = new Set(item.authority.evidence.map(evidence => `[evidence:${evidence.id}]`));
    for (const fact of summary.facts) {
      claims++;
      if (
        fact.references.some(reference => ids.has(reference)) &&
        fact.references.every(reference => ids.has(reference) || reference === item.authority.runbookReference)
      )
        attributed++;
      if (item.authority.canonicalSummary?.facts.some(canonical => canonicalJson(canonical) === canonicalJson(fact)))
        supported++;
    }
    if (
      decision.runbookReference === item.authority.runbookReference &&
      item.authority.selectedRunbook.active &&
      item.authority.selectedRunbook.hash === item.authority.runbookHash &&
      item.authority.selectedRunbook.rules.length > 0 &&
      canonicalJson(item.authority.selectedRunbook.rules) === canonicalJson(item.authority.mandatoryRules) &&
      canonicalJson(item.authority.selectedRunbook.allowedActions) === canonicalJson(item.authority.allowedActions) &&
      canonicalJson(decision) === canonicalJson(item.authority.canonicalDecision) &&
      canonicalJson(plan) === canonicalJson(item.authority.canonicalPlan) &&
      plan.actions.every(action => item.authority.allowedActions.includes(action.type)) &&
      calculatePlanHash(plan) === plan.planHash &&
      canonicalJson(summary) === canonicalJson(item.authority.canonicalSummary)
    )
      compliant++;
  }
  return {
    severity: {
      ...metric(
        f1.reduce((sum, value) => sum + value, 0),
        labels.length,
        0.9,
      ),
      population: observations.length,
      aggregation: 'macro-F1',
    },
    attribution: metric(attributed, claims),
    compliance: metric(compliant, runbooks),
    hallucination: {
      ...metric(supported, claims),
      unsupportedClaims: claims - supported,
      unsupportedClaimRate: claims ? (claims - supported) / claims : null,
      maximumUnsupportedClaimRate: 0,
      interpretation: 'canonical supported-claim fraction; not free-text LLM quality',
    },
    safety: metric(observations.filter(safeContainment).length, observations.length),
  };
}

const names = ['severity', 'attribution', 'compliance', 'hallucination', 'safety'] as const;
export const workflowMastraScorers = Object.fromEntries(
  names.map(name => [
    name,
    createScorer({
      id: `workflow-${name}-v1`,
      description: `DB-backed deterministic local workflow ${name} gate; no model benchmark.`,
    }).generateScore(({ run }) => {
      const parsed = WorkflowArtifactSchema.safeParse(run.output);
      if (!parsed.success) return 0;
      try {
        return workflowMetrics(parsed.data)[name].passed ? 1 : 0;
      } catch {
        return 0;
      }
    }),
  ]),
);

export async function scoreWorkflowArtifact(value: unknown) {
  const artifact = WorkflowArtifactSchema.parse(value);
  const metrics = workflowMetrics(artifact);
  const official = Object.fromEntries(
    await Promise.all(
      names.map(async name => [name, (await workflowMastraScorers[name]!.run({ output: artifact })).score]),
    ),
  );
  return {
    schemaVersion: 1,
    corpusHash: artifact.corpusHash,
    population: artifact.population,
    mode: artifact.mode,
    metrics,
    official,
    passed: Object.values(metrics).every(value => value.passed) && Object.values(official).every(score => score === 1),
  };
}
