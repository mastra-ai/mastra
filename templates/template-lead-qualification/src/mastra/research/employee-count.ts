import type { QualificationConfig } from '../config/qualification';
import { employeeIntervalSchema } from './contracts';
import type { EmployeeInterval, Fact } from './contracts';

type EmployeeRule = QualificationConfig['policy']['rules']['employeeCount'];

export function evaluateEmployeeInterval(interval: EmployeeInterval, rule: EmployeeRule) {
  if (interval.min >= rule.min && interval.max !== null && interval.max <= rule.max)
    return { state: 'matched', gap: 'resolved' } as const;
  if (interval.min > rule.max || (interval.max !== null && interval.max < rule.min))
    return { state: 'mismatched', gap: 'resolved' } as const;
  return { state: 'unknown', gap: interval.max === null ? 'lower_bound_only' : 'boundary_overlap' } as const;
}

export function evaluateEmployeeCount(fact: Fact, rule: EmployeeRule) {
  const parsed = employeeIntervalSchema.safeParse(fact.value);
  const interval = parsed.success ? parsed.data : null;
  if (fact.disposition !== 'accepted' || !interval) return { interval, state: 'unknown', gap: 'unresolved' } as const;
  if (fact.basis === 'inferred' && rule.estimates === 'review')
    return { interval, state: 'unknown', gap: 'estimate_requires_review' } as const;
  return { interval, ...evaluateEmployeeInterval(interval, rule) };
}
