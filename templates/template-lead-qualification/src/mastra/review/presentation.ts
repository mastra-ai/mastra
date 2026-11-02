import { employeeIntervalSchema } from '../research/contracts';
import type { Assessment } from '../research/contracts';
import type { OwnedPatch } from './contracts';

export const labels = {
  businessModel: 'Business model',
  employeeCount: 'Employees',
  headquartersCountry: 'Headquarters country',
  buyingIntent: 'Buying intent',
  identity: 'Company identity',
  policy: 'Qualification policy',
  needs_review: 'Needs review',
  qualified: 'Qualified',
  nurture: 'Nurture',
  disqualified: 'Disqualified',
} as const;
const states = {
  matched: 'Matches',
  mismatched: 'Outside your target profile',
  unknown: 'Needs confirmation',
  no_signal: 'No recent inquiry in inspected evidence',
};
export const actions = {
  businessModel: 'Confirm what the company sells and who its customers are.',
  employeeCount: 'Confirm a reliable, current team size.',
  headquartersCountry: 'Confirm the headquarters country, rather than an office location.',
  buyingIntent: 'Confirm the date and purpose of the lead’s inquiry.',
  identity: 'Confirm which company this lead belongs to before making a decision.',
  policy: 'Review the findings and move Qualification stage to your final outcome.',
};
function explanation(assessment: Assessment, attribute: keyof typeof actions): string {
  if (attribute === 'identity') return 'We could not confidently identify one company for this lead.';
  if (attribute === 'policy') return 'Your review policy asks an SDR to confirm this outcome.';
  if (assessment.identity.status !== 'resolved') return 'Confirm the company identity before assessing this criterion.';
  const fact = assessment.facts[attribute];
  const state = assessment.result.contributions.find(rule => rule.rule === attribute)!.state;
  if (fact.disposition === 'conflicting') return `The sources disagree. ${actions[attribute]}`;
  if (fact.disposition === 'stale') return `The available information is too old to rely on. ${actions[attribute]}`;
  if (attribute === 'businessModel') {
    if (fact.disposition !== 'accepted' || typeof fact.value !== 'string')
      return 'We could not confirm the company’s business model.';
    const category = fact.value === 'b2b_saas' ? 'B2B SaaS' : fact.value.replace(/[_-]+/g, ' ');
    return `${fact.basis === 'inferred' ? 'The evidence suggests' : 'The company is classified as'} ${category}. This ${state === 'matched' ? 'matches' : 'falls outside'} the business models you target.`;
  }
  if (attribute === 'employeeCount') {
    const parsed = employeeIntervalSchema.safeParse(fact.value);
    if (fact.disposition !== 'accepted' || !parsed.success)
      return 'We could not confirm a reliable, current team size.';
    const { min, max } = parsed.data;
    const count = max === null ? `at least ${min}` : min === max ? String(min) : `${min}–${max}`;
    const policy = assessment.snapshot.config.policy.rules.employeeCount;
    const finding = `Sources ${fact.basis === 'inferred' ? 'suggest' : 'report'} ${count} employees.`;
    if (fact.basis === 'inferred' && policy.estimates === 'review')
      return `${finding} This is an estimate and needs SDR confirmation under your review policy.`;
    const estimate = fact.basis === 'inferred' ? ' This is an estimate.' : '';
    return `${finding}${estimate} ${state === 'matched' ? 'This fits' : state === 'mismatched' ? 'This falls outside' : 'We need a more precise count to check'} your target of ${policy.min}–${policy.max} employees.`;
  }
  if (attribute === 'headquartersCountry') {
    if (fact.disposition !== 'accepted' || typeof fact.value !== 'string')
      return 'We could not confirm the company’s headquarters country.';
    const country = new Intl.DisplayNames(['en'], { type: 'region' }).of(fact.value) ?? fact.value;
    return `The company’s headquarters are in ${country}. This country ${state === 'matched' ? 'is' : 'is not'} in your target markets.`;
  }
  const days = assessment.snapshot.config.policy.rules.buyingIntent.maxAgeDays;
  return state === 'matched'
    ? `A supported inquiry was made within the last ${days} days.`
    : state === 'no_signal'
      ? `The inspected evidence contains no qualifying inquiry from the last ${days} days.`
      : 'We could not confirm a qualifying, dated inquiry from this lead.';
}
/** Readable business findings shared by destination presentations. */
export function presentAssessment(
  assessment: Assessment,
  patch: OwnedPatch,
  nextAction: string,
  reviewAction: string,
): OwnedPatch {
  return {
    ...patch,
    presentationVersion: 1,
    summary: [
      'Qualification assessment',
      `Company: ${assessment.identity.companyName ?? assessment.identity.domain ?? 'Identity needs confirmation'}${assessment.identity.companyName && assessment.identity.domain ? ` (${assessment.identity.domain})` : ''}\nAssessment outcome: ${labels[assessment.result.classification]}\nScore: ${assessment.result.score}/100`,
      ...assessment.result.contributions.map(
        rule =>
          `${labels[rule.rule]} — ${states[rule.state]} (${rule.points} points)\n${explanation(assessment, rule.rule)}`,
      ),
      `Assessment next step\n${nextAction}`,
    ].join('\n\n'),
    gaps: patch.reviewReasons.map(reason => explanation(assessment, reason.attribute)),
    reviewReasons: patch.reviewReasons.map(reason => ({
      ...reason,
      explanation:
        reason.code === 'manual_review'
          ? 'An SDR moved this lead back to Needs review.'
          : explanation(assessment, reason.attribute),
      action:
        reason.code === 'manual_review' || reason.attribute === 'policy' ? reviewAction : actions[reason.attribute],
    })),
    nextAction,
  };
}
