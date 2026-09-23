import { createHash } from 'node:crypto';
import type { IncidentKind } from '../../schemas/incident.js';

export const WORKFLOW_CORPUS_VERSION = 'local-workflow-v1';
export type WorkflowCase = Readonly<{
  id: string;
  kind: IncidentKind;
  decision: 'approved' | 'rejected' | 'expired' | 'benign';
  severity: 'low' | 'medium' | 'high';
}>;

// Expected labels are independent of the execution outputs. This deliberately
// small regression corpus is not the immutable 72-case policy replay dataset.
export const workflowCorpus: readonly WorkflowCase[] = [
  ...(['approved', 'rejected', 'expired'] as const).flatMap(decision => [
    {
      id: `privilege-${decision}`,
      kind: 'unauthorized_privilege_change' as const,
      decision,
      severity: 'high' as const,
    },
    {
      id: `country-${decision}`,
      kind: 'disallowed_country_login' as const,
      decision,
      severity: 'medium' as const,
    },
    {
      id: `device-${decision}`,
      kind: 'unknown_device_login' as const,
      decision,
      severity: 'medium' as const,
    },
  ]),
  {
    id: 'country-benign',
    kind: 'disallowed_country_login',
    decision: 'benign',
    severity: 'low',
  },
];

export function evalHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export const workflowCorpusHash = evalHash(workflowCorpus);
