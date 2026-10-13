import type { ClassifierQuestions } from '@mastra/core/classifier';

import { POLICY_DEFAULTS, RUBRIC, SOURCE_LIMITS, TIMING } from '../config';
import { INTEREST_DEFINITIONS, type MonitorInterest } from '../schemas';
import type { Evidence } from './content';

export const CLASSIFIER_ID = 'competitor-change-classifier';
export const QUESTION_SET_VERSION = 'jev-change-v1';
export const RULE_VERSION = 'routing-v1';

export const COMPETITOR_CHANGE_QUESTIONS = {
  change_type: {
    type: 'choice',
    instructions:
      'Choose the one primary factual category. Choose mixed when multiple material categories are inseparable.',
    criteria: {
      pricing: 'A price, rate, discount, billing unit, or monetary charge changed.',
      packaging: 'An entitlement, plan boundary, bundle, or availability tier changed.',
      product_feature: 'A product capability was added, removed, or materially changed.',
      availability: 'Regional, product, service, or access availability changed.',
      deprecation: 'A feature, API, plan, or service was removed or is being retired.',
      policy_terms: 'A contractual, privacy, support, or other policy term changed.',
      security_compliance: 'A security control, certification, or compliance commitment changed.',
      documentation: 'Documentation changed without a clear product or commercial change.',
      company_announcement: 'A company announcement changed without a direct product change.',
      cosmetic_navigation: 'Only presentation, navigation, or promotional wording changed.',
      mixed: 'Several material categories are inseparable in this one evidence block.',
      unknown: 'The evidence does not support a faithful category.',
    },
  },
  relevance: {
    type: 'score',
    instructions:
      'Score relevance to the supplied operator interests from 0 through 4. Use interestDefinitions for each selected topic and consider organizationContext, prioritySignals, and ignoredSignals as context, not hard filters.',
    criteria: ['Unrelated', 'Weak match', 'Clear limited match', 'Priority topic', 'Critical priority signal'],
  },
  business_impact: {
    type: 'score',
    instructions: 'Score likely business impact from 0 through 4 without estimating money.',
    criteria: ['No impact', 'Informational', 'Planning impact', 'Material response', 'Critical impact'],
  },
  is_substantive: {
    type: 'boolean',
    instructions: 'Is this a factual or semantic change rather than layout or wording?',
  },
  is_breaking_change: { type: 'boolean', instructions: 'Is this a removal, deprecation, or incompatible alteration?' },
  is_cosmetic_or_promotional: {
    type: 'boolean',
    instructions: 'Is this styling, navigation, or promotion without a factual change?',
  },
} as const satisfies ClassifierQuestions;

export type ClassificationRoute = 'alert' | 'review' | 'record' | 'ignore';
type Answers = {
  change_type: { type: 'choice'; choice: string; probabilities?: Record<string, number> };
  relevance: { type: 'score'; score: number };
  business_impact: { type: 'score'; score: number };
  is_substantive: { type: 'boolean'; probability: number };
  is_breaking_change: { type: 'boolean'; probability: number };
  is_cosmetic_or_promotional: { type: 'boolean'; probability: number };
};

export type ClassificationDecision = {
  route: ClassificationRoute;
  reason: string;
  ruleVersion: string;
  effectivePolicy: { [Key in keyof typeof POLICY_DEFAULTS]: number };
};
type PolicyOverrides = Partial<ClassificationDecision['effectivePolicy']>;

function confidence(metadata: unknown, question: string) {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const typesafe = (metadata as Record<string, unknown>).typesafe;
  const values =
    typesafe && typeof typesafe === 'object' ? (typesafe as Record<string, unknown>).confidence : undefined;
  const value = values && typeof values === 'object' ? (values as Record<string, unknown>)[question] : undefined;
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= RUBRIC.minProbability &&
    value <= RUBRIC.maxProbability
    ? value
    : undefined;
}

export function routeClassification(
  evidence: Evidence,
  answers: Answers,
  providerMetadata: unknown,
  overrides: PolicyOverrides = {},
): ClassificationDecision {
  const policy = { ...POLICY_DEFAULTS, ...overrides };
  const choiceConfidence = confidence(providerMetadata, 'change_type');
  const relevanceConfidence = confidence(providerMetadata, 'relevance');
  const impactConfidence = confidence(providerMetadata, 'business_impact');
  const probabilities = answers.change_type.probabilities;
  const values = probabilities ? Object.values(probabilities).sort((a, b) => b - a) : [];
  const margin = values.length > 1 ? values[0]! - values[1]! : undefined;
  const invalidScore = [answers.relevance.score, answers.business_impact.score].some(
    value => !Number.isFinite(value) || value < RUBRIC.minScore || value > RUBRIC.maxScore,
  );
  const invalidProbability = [
    answers.is_substantive.probability,
    answers.is_breaking_change.probability,
    answers.is_cosmetic_or_promotional.probability,
  ].some(value => !Number.isFinite(value) || value < RUBRIC.minProbability || value > RUBRIC.maxProbability);
  const uncertain =
    (!evidence.beforeText && !evidence.afterText) ||
    answers.change_type.choice === 'mixed' ||
    answers.change_type.choice === 'unknown' ||
    choiceConfidence === undefined ||
    relevanceConfidence === undefined ||
    impactConfidence === undefined ||
    choiceConfidence < policy.minimumChoiceConfidence ||
    relevanceConfidence < policy.minimumScoreConfidence ||
    impactConfidence < policy.minimumScoreConfidence ||
    margin === undefined ||
    (margin ?? 0) + Number.EPSILON < policy.minimumChoiceMargin ||
    invalidScore ||
    invalidProbability;
  if (uncertain) {
    return decision(
      'review',
      answers.change_type.choice === 'mixed' ? 'COMPOUND_CHANGE' : 'CLASSIFICATION_UNCERTAIN',
      policy,
    );
  }
  const substantive = answers.is_substantive.probability >= policy.minimumSubstantiveProbability;
  const breaking = answers.is_breaking_change.probability >= policy.minimumBreakingProbability;
  const cosmetic = answers.is_cosmetic_or_promotional.probability >= policy.minimumCosmeticProbability;
  if (cosmetic && (substantive || breaking)) return decision('review', 'CONFLICTING_SIGNALS', policy);
  const relevant = answers.relevance.score >= policy.alertFromRelevanceLevel;
  const impactful = answers.business_impact.score >= policy.alertFromImpactLevel;
  if (breaking)
    return substantive && relevant
      ? decision('alert', 'BREAKING_SUBSTANTIVE_CHANGE', policy)
      : decision('review', 'BREAKING_UNCONFIRMED', policy);
  if (cosmetic && !substantive) return decision('ignore', 'COSMETIC_CHANGE', policy);
  if (substantive && relevant && impactful) return decision('alert', 'SUBSTANTIVE_IMPACTFUL_CHANGE', policy);
  return decision('record', substantive ? 'SUBSTANTIVE_MONITOR' : 'LOW_SUBSTANTIVE_PROBABILITY', policy);
}

function decision(
  route: ClassificationRoute,
  reason: string,
  effectivePolicy: ClassificationDecision['effectivePolicy'],
): ClassificationDecision {
  return { route, reason, ruleVersion: RULE_VERSION, effectivePolicy };
}

export function classificationState(input: {
  evidence: Evidence;
  source: { id: string; label: string; url: string; kind: string };
  interests: MonitorInterest[];
  prioritySignals: string[];
  ignoredSignals: string[];
  organizationContext?: string;
}) {
  const state = {
    source: {
      id: input.source.id,
      label: input.source.label,
      hostname: new URL(input.source.url).hostname,
      kind: input.source.kind,
    },
    interests: input.interests,
    interestDefinitions: input.interests.map(interest => ({
      interest,
      meaning: INTEREST_DEFINITIONS[interest],
    })),
    prioritySignals: input.prioritySignals,
    ignoredSignals: input.ignoredSignals,
    ...(input.organizationContext === undefined ? {} : { organizationContext: input.organizationContext }),
    evidence: {
      sectionKey: input.evidence.sectionKey,
      kind: input.evidence.kind,
      before: input.evidence.beforeText,
      after: input.evidence.afterText,
    },
  };
  if (JSON.stringify(state).length > SOURCE_LIMITS.maxCandidateStateChars) throw new Error('CANDIDATE_STATE_LIMIT');
  return state;
}

export function classificationAbortSignal(signal: AbortSignal) {
  return AbortSignal.any([signal, AbortSignal.timeout(TIMING.jevCallMs)]);
}

export function sanitizedClassificationError(error: unknown) {
  if (error instanceof DOMException && error.name === 'TimeoutError') return 'CLASSIFICATION_TIMEOUT';
  if (error instanceof Error && /abort/i.test(error.name)) return 'CLASSIFICATION_ABORTED';
  if (error instanceof Error && /validation|invalid|schema/i.test(error.message))
    return 'CLASSIFICATION_INVALID_RESULT';
  return 'CLASSIFICATION_PROVIDER_FAILURE';
}
