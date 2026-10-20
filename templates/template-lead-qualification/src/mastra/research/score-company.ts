import { z } from 'zod';
import { evaluateEmployeeCount } from './employee-count';
import { qualificationConfigSchema } from '../config/qualification';
import { factsSchema, identitySchema, scoreSchema, signalSchema } from './contracts';

const scoreInputSchema = z.strictObject({
  identity: identitySchema,
  facts: factsSchema,
  policy: qualificationConfigSchema.shape.policy,
  routing: qualificationConfigSchema.shape.routing,
  assessmentTime: z.iso.datetime({ offset: true }),
});
function score(input: z.infer<typeof scoreInputSchema>): z.infer<typeof scoreSchema> {
  const { identity, facts, policy, routing, assessmentTime } = input;
  const rules = policy.rules;
  const contributions: z.infer<typeof scoreSchema>['contributions'] = [];
  function add(rule: keyof typeof rules, state: 'matched' | 'mismatched' | 'unknown' | 'no_signal', reason: string) {
    contributions.push({ rule, state, reason, points: state === 'matched' ? rules[rule].points : 0 });
  }
  const business = facts.businessModel;
  add(
    'businessModel',
    business.disposition !== 'accepted'
      ? 'unknown'
      : typeof business.value === 'string' && rules.businessModel.accepted.includes(business.value)
        ? 'matched'
        : 'mismatched',
    business.disposition !== 'accepted'
      ? `Business model is ${business.disposition}; establish a classification using the captured business-model criteria.`
      : `Business model: ${typeof business.value === 'string' ? business.value : 'unknown'}.`,
  );
  const employees = facts.employeeCount;
  const { interval, state: size } = evaluateEmployeeCount(employees, rules.employeeCount);
  add(
    'employeeCount',
    size,
    interval
      ? `${employees.basis === 'inferred' ? 'Inferred employee estimate' : 'Observed employee interval'} ${interval.min}–${interval.max ?? 'open'}; required ${rules.employeeCount.min}–${rules.employeeCount.max}${size === 'unknown' ? (employees.basis === 'inferred' && rules.employeeCount.estimates === 'review' ? '; inferred estimates require review under the captured policy' : '; confirm a count entirely inside or outside the boundary') : ''}.`
      : `Employee count is ${employees.disposition}; obtain workforce evidence or a grounded estimate.`,
  );
  const country = facts.headquartersCountry;
  add(
    'headquartersCountry',
    country.disposition !== 'accepted'
      ? 'unknown'
      : typeof country.value === 'string' && rules.headquartersCountry.allowed.includes(country.value)
        ? 'matched'
        : 'mismatched',
    country.disposition !== 'accepted'
      ? `Headquarters country is ${country.disposition}; confirm headquarters rather than an office or service market.`
      : `Headquarters country: ${typeof country.value === 'string' ? country.value : 'unknown'}.`,
  );
  const intent = facts.buyingIntent;
  const signals = z.array(signalSchema).safeParse(intent.value);
  const time = Date.parse(assessmentTime);
  const invalidDate =
    signals.success && signals.data.some(signal => signal.occurredAt === null || Date.parse(signal.occurredAt) > time);
  const recent =
    signals.success &&
    signals.data.some(
      signal =>
        rules.buyingIntent.acceptedSignals.includes(signal.type) &&
        signal.occurredAt !== null &&
        Date.parse(signal.occurredAt) <= time &&
        time - Date.parse(signal.occurredAt) <= rules.buyingIntent.maxAgeDays * 86_400_000,
    );
  add(
    'buyingIntent',
    intent.disposition !== 'accepted' || !signals.success || invalidDate ? 'unknown' : recent ? 'matched' : 'no_signal',
    intent.disposition !== 'accepted' || invalidDate
      ? `Buying intent is ${invalidDate ? 'undated or future-dated' : intent.disposition}; confirm a dated inbound inquiry.`
      : recent
        ? `A supported buying inquiry is within ${rules.buyingIntent.maxAgeDays} days.`
        : `No qualifying buying inquiry was observed within ${rules.buyingIntent.maxAgeDays} days in the inspected sources.`,
  );
  if (identity.status !== 'resolved')
    for (const contribution of contributions) {
      contribution.points = 0;
      contribution.state = 'unknown';
      contribution.reason = `Confirm company identity before evaluating ${contribution.rule}.`;
    }
  const reviewReasons = contributions.filter(rule => rule.state === 'unknown').map(rule => rule.reason);
  const classification =
    identity.status !== 'resolved'
      ? 'needs_review'
      : contributions.some(rule => rule.state === 'mismatched')
        ? 'disqualified'
        : reviewReasons.length
          ? 'needs_review'
          : contributions.every(rule => rule.state === 'matched')
            ? 'qualified'
            : 'nurture';
  if (identity.status !== 'resolved') reviewReasons.unshift(identity.reason);
  return {
    score: identity.status === 'resolved' ? contributions.reduce((sum, rule) => sum + rule.points, 0) : 0,
    classification,
    requiresReview: routing.reviewOutcomes.includes(classification),
    contributions,
    reviewReasons,
    nextAction:
      classification === 'needs_review'
        ? `Verify the unresolved facts: ${reviewReasons.join(' ')}`
        : classification === 'qualified'
          ? 'Contact the lead about the supported inquiry.'
          : classification === 'nurture'
            ? 'Nurture the account and ask about a concrete buying need.'
            : 'Record the decisive ICP mismatch; reconsider only with new evidence in a new cycle.',
  };
}
export function scoreCompany(input: z.infer<typeof scoreInputSchema>) {
  return scoreSchema.parse(score(scoreInputSchema.parse(input)));
}
