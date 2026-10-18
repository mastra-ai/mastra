export const RUNBOOK_SECTIONS = Object.freeze([
  'Purpose and Preconditions',
  'Signals and Known False Positives',
  'Required and Optional Evidence',
  'Severity Rules',
  'Investigation',
  'Allowed and Prohibited Actions',
  'Approval Requirements',
  'Post-Containment Validation',
  'Rollback and Escalation',
] as const);

export function sectionKey(heading: string): string {
  return heading
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/(^-|-$)/gu, '');
}
