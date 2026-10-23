import type { TermValue } from './reconciliation-contracts.js';
export const reportLabels = {
  category: {
    entity: 'Identity',
    date: 'Dates',
    location: 'Locations and premises',
    limit: 'Coverage limits',
    deductible: 'Deductibles and retentions',
    clause: 'Clauses and conditions',
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
