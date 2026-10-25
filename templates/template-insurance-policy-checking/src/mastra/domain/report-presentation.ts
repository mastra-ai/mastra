import type { TermValue } from './reconciliation-contracts.js';
import type { ReportSnapshot } from './report-contracts.js';
export const reportLabels = {
  category: {
    entity: 'Identity',
    identity: 'Policy identity',
    date: 'Dates',
    dates: 'Dates',
    policy_period: 'Policy period',
    location: 'Locations and premises',
    locations: 'Locations and premises',
    insured_property: 'Insured property and locations',
    limit: 'Coverage limits',
    limits: 'Coverage limits',
    deductible: 'Deductibles and retentions',
    deductibles: 'Deductibles and retentions',
    clause: 'Clauses and conditions',
    clauses: 'Clauses and conditions',
    other: 'Additional terms',
    'response-assistance': 'Response assistance',
  },
  classification: {
    MATCH: 'Matching terms',
    AUTHORIZED_CHANGE: 'Documented authorized change',
    DISCREPANCY: 'Discrepancy identified',
    MISSING_EVIDENCE: 'Supporting evidence is missing',
    REQUIRES_REVIEW: 'This finding requires review',
  },
  status: {
    INCONCLUSIVE: 'A reliable conclusion could not be reached',
    REVIEW_REQUIRED: 'Broker review is required',
    NO_DISCREPANCIES_DETECTED: 'No discrepancies were detected',
  },
  role: {
    proposal: 'Proposal',
    contract: 'Contract',
    issued_policy: 'Issued policy',
    binder: 'Binder',
    amendment: 'Amendment',
    reference: 'Comparison reference',
    unknown: 'Role not yet identified',
  },
  intent: { document_comparison: 'Document comparison', agreed_terms_checking: 'Agreed-term policy checking' },
  severity: { High: 'High', Medium: 'Medium', Low: 'Low' },
} as const;
const words = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
export function categoryLabel(category: string): string {
  const readable = words(category);
  const known = Object.entries(reportLabels.category).find(([key]) => words(key) === readable)?.[1];
  return known ?? (readable ? readable[0]!.toUpperCase() + readable.slice(1) : 'Additional policy terms');
}

function dateBounds(value: string): [number, number] {
  const [year, month, day] = value.split('-').map(Number) as [number, number?, number?];
  const lastMonth = month ?? 12;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const lastDay = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][lastMonth - 1]!;
  return [year * 10000 + (month ?? 1) * 100 + (day ?? 1), year * 10000 + lastMonth * 100 + (day ?? lastDay)];
}

/** Read only sourced issued-policy terms; reference and amendment dates are not cover metadata. */
export function issuedPolicyDates(report: ReportSnapshot): string {
  if (!report.sources.some(source => source.sourceId === report.targetId && source.role === 'issued_policy'))
    return 'Not available';
  const dates = { inception: new Set<string>(), expiry: new Set<string>() };
  const uncertain = { inception: false, expiry: false };
  const wholePolicyScopes = new Set(['policy', 'entire policy', 'whole policy', 'full policy', 'policy period']);
  if (report.identity.policyNumber) {
    const policyNumber = words(report.identity.policyNumber);
    for (const prefix of ['policy ', 'policy number ', 'policy no ']) wholePolicyScopes.add(prefix + policyNumber);
  }
  for (const finding of report.comparisons) {
    const term = finding.actual;
    if (
      !term ||
      !['date', 'dates', 'policy period', 'coverage period'].includes(words(term.category)) ||
      !wholePolicyScopes.has(words(term.scope)) ||
      !term.evidence.some(evidence => evidence.sourceId === report.targetId)
    )
      continue;
    const key = words(term.key).replace(/^(?:policy|coverage) /, '');
    const end = ['inception', 'start', 'start date', 'effective date'].includes(key)
      ? 'inception'
      : ['expiry', 'expiration', 'end', 'end date', 'expiry date', 'expiration date'].includes(key)
        ? 'expiry'
        : null;
    if (!end) continue;
    if (term.value.type !== 'date' || term.uncertainty.length || finding.uncertainty.length) uncertain[end] = true;
    else dates[end].add(term.value.value);
  }
  const start = !uncertain.inception && dates.inception.size === 1 ? [...dates.inception][0] : undefined;
  const end = !uncertain.expiry && dates.expiry.size === 1 ? [...dates.expiry][0] : undefined;
  if (start && end) {
    const [earliestStart, latestStart] = dateBounds(start);
    const [earliestEnd, latestEnd] = dateBounds(end);
    if (earliestStart > latestEnd) return 'Conflicting policy dates; review the issued policy';
    if (latestStart > earliestEnd) return `Policy date order requires review (${start} to ${end})`;
    return `${start} to ${end}`;
  }
  const startReview = uncertain.inception || dates.inception.size > 1;
  const endReview = uncertain.expiry || dates.expiry.size > 1;
  if (!start && !end && !startReview && !endReview) return 'Not available';
  return `${start ? 'Starts ' + start : startReview ? 'Inception requires review' : 'Inception not available'}; ${end ? 'expires ' + end : endReview ? 'expiry requires review' : 'expiry not available'}`;
}
export function termValue(value: TermValue | null | undefined): string {
  if (!value) return 'Not available';
  switch (value.type) {
    case 'money':
      return `${value.currency} ${value.amount} ${value.unit}; ${value.basis}${value.minimum !== null ? `; minimum ${value.minimum}` : ''}${value.maximum !== null ? `; maximum ${value.maximum}` : ''}`;
    case 'number':
      return `${value.amount} ${value.unit}; ${value.basis}`;
    case 'date':
      return value.value;
    case 'entity':
      return [value.name, value.address, value.unit].filter(Boolean).join(', ');
    case 'clause':
      return value.wording;
    case 'text':
      return value.value;
  }
}
