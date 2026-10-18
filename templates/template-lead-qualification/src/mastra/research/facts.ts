import type { QualificationSnapshot } from '../config/qualification';
import { candidatePassages, employeeIntervalSchema, factSchema } from './contracts';
import type { BranchResult, Candidate, Fact, ResearchRound } from './contracts';
import { evaluateEmployeeCount, evaluateEmployeeInterval } from './employee-count';

const attributes = ['businessModel', 'employeeCount', 'headquartersCountry', 'buyingIntent'] as const;
type Facts = Record<Candidate['attribute'], Fact>;

export function collectFacts(branches: BranchResult[], snapshot: QualificationSnapshot): Facts {
  const grouped: Record<Candidate['attribute'], Candidate[]> = {
    businessModel: [],
    employeeCount: [],
    headquartersCountry: [],
    buyingIntent: [],
  };
  const rejected = new Set<Candidate['attribute']>();
  for (const branch of branches) {
    for (const candidate of branch.candidates) grouped[candidate.attribute].push(candidate);
    for (const rejection of branch.rejections) rejected.add(rejection.attribute);
  }
  const collect = (attribute: Candidate['attribute']) =>
    collectFact(
      attribute,
      grouped[attribute].sort((a, b) => a.id.localeCompare(b.id)),
      rejected.has(attribute),
      branches,
      snapshot,
    );
  return {
    businessModel: collect('businessModel'),
    employeeCount: collect('employeeCount'),
    headquartersCountry: collect('headquartersCountry'),
    buyingIntent: collect('buyingIntent'),
  };
}

export function missingAttributes(facts: Facts, snapshot: QualificationSnapshot) {
  return attributes.filter(attribute =>
    attribute === 'employeeCount'
      ? evaluateEmployeeCount(facts.employeeCount, snapshot.config.policy.rules.employeeCount).state === 'unknown'
      : facts[attribute].disposition !== 'accepted',
  );
}

function collectFact(
  attribute: Candidate['attribute'],
  candidates: Candidate[],
  unsupported: boolean,
  branches: BranchResult[],
  snapshot: QualificationSnapshot,
): Fact {
  const evidenceIds = [
    ...new Set(candidates.flatMap(candidate => candidatePassages(candidate).map(passage => passage.evidenceId))),
  ].sort();
  const common = {
    evidenceIds,
    candidateIds: candidates.map(candidate => candidate.id),
    freshness: 'current' as const,
    basis:
      candidates.length > 0 && candidates.every(candidate => candidate.inference)
        ? ('inferred' as const)
        : ('observed' as const),
  };
  if (!candidates.length) {
    const coverage =
      attribute === 'buyingIntent' &&
      !unsupported &&
      branches.some(
        branch =>
          branch.branch === 'signals' &&
          branch.intentCoverageComplete &&
          branch.evidence.length > 0 &&
          branch.failures.length === 0,
      );
    return factSchema.parse({
      ...common,
      value: coverage ? [] : null,
      disposition: coverage ? 'accepted' : unsupported ? 'unsupported' : 'missing',
      evidenceIds: coverage
        ? branches
            .filter(branch => branch.branch === 'signals')
            .flatMap(branch => branch.evidence.map(evidence => evidence.id))
            .sort()
        : [],
      freshness: coverage ? 'current' : 'unknown',
    });
  }
  if (
    attribute !== 'buyingIntent' &&
    candidates.some(
      candidate =>
        candidate.asOf !== null &&
        (Date.parse(candidate.asOf) > Date.parse(snapshot.assessmentTime) ||
          Date.parse(snapshot.assessmentTime) - Date.parse(candidate.asOf) >
            snapshot.config.sources.maxEvidenceAgeDays * 86_400_000),
    )
  )
    return factSchema.parse({ ...common, value: null, disposition: 'stale', freshness: 'stale' });
  if (attribute === 'employeeCount') {
    const intersect = (items: Candidate[]) => {
      const values = items.map(candidate => employeeIntervalSchema.parse(candidate.value));
      return {
        min: Math.max(...values.map(value => value.min)),
        max: values.reduce<number | null>(
          (max, value) => (value.max === null ? max : Math.min(max ?? value.max, value.max)),
          null,
        ),
      };
    };
    const value = intersect(candidates);
    if (!employeeIntervalSchema.safeParse(value).success)
      return factSchema.parse({ ...common, value: null, disposition: 'conflicting' });
    const observed = candidates.filter(candidate => !candidate.inference);
    const observation = observed.length ? intersect(observed) : null;
    const rule = snapshot.config.policy.rules.employeeCount;
    const decisiveObservation = observation && evaluateEmployeeInterval(observation, rule).state !== 'unknown';
    const scored = rule.estimates === 'review' && decisiveObservation ? observation : value;
    const basis = observation && JSON.stringify(observation) === JSON.stringify(scored) ? 'observed' : 'inferred';
    return factSchema.parse({ ...common, value: scored, basis, disposition: 'accepted' });
  }
  const unique = [...new Map(candidates.map(candidate => [JSON.stringify(candidate.value), candidate.value])).values()];
  if (attribute !== 'buyingIntent' && unique.length > 1)
    return factSchema.parse({ ...common, value: null, disposition: 'conflicting' });
  if (attribute === 'buyingIntent' && unsupported)
    return factSchema.parse({ ...common, value: null, disposition: 'unsupported' });
  return factSchema.parse({
    ...common,
    value: attribute === 'buyingIntent' ? unique : unique[0],
    disposition: 'accepted',
  });
}
export function gapReason(
  attribute: Candidate['attribute'],
  fact: Fact,
  branches: BranchResult[],
  snapshot: QualificationSnapshot,
  budget: boolean,
): ResearchRound['diagnostic']['gap'] {
  if (budget) return 'budget';
  if (fact.disposition === 'conflicting') return 'conflict';
  if (fact.disposition === 'stale') return 'stale';
  if (fact.disposition === 'unsupported') return 'rejected';
  if (attribute === 'employeeCount' && fact.disposition === 'accepted')
    return evaluateEmployeeCount(fact, snapshot.config.policy.rules.employeeCount).gap;
  if (fact.disposition === 'accepted') return 'resolved';
  const relevant = branches.filter(
    branch => branch.branch === (attribute === 'buyingIntent' ? 'signals' : 'firmographics'),
  );
  if (!relevant.some(branch => branch.evidence.length)) return 'content_unavailable';
  const latest = relevant.findLast(
    branch => branch.evidence.length || branch.failures.length || branch.analysisComplete,
  );
  if (!latest?.analysisComplete || latest.failures.length)
    return latest?.failures.some(failure =>
      ['request_budget_exhausted', 'resource_budget_exhausted', 'deadline_exhausted'].includes(failure.code),
    )
      ? 'budget'
      : 'unresolved';
  return attribute === 'employeeCount' ? 'no_count_observed' : 'unresolved';
}
