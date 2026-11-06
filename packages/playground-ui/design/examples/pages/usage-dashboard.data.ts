import type { UsageDashboardProps } from './usage-dashboard';

export const exampleUsage: Pick<UsageDashboardProps, 'range' | 'totals' | 'models'> = {
  range: 'last-7d',
  totals: { requests: 48210, spend: 312.4, changePct: 12.4 },
  models: [
    { id: 'model-a', name: 'Fast model', requests: 30120, spend: 61.2 },
    { id: 'model-b', name: 'Balanced model', requests: 14870, spend: 188.35 },
    { id: 'model-c', name: 'Reasoning model', requests: 3220, spend: 62.85 },
  ],
};
