import type { FilterBarField } from '@/ds/components/FilterBar';

/** Target fields as a host builds them (e.g. with `useTargetFilterFields`) for an agent target. */
export const agentTargetFields: FilterBarField[] = [
  {
    id: 'targetType',
    label: 'Target type',
    operators: ['is'],
    strict: true,
    suggestions: [{ value: 'agent', label: 'Agent' }],
  },
  {
    id: 'targetId',
    label: 'Agent',
    operators: ['is'],
    strict: true,
    suggestions: [{ value: 'agent-1', label: 'Support Agent' }],
  },
];
