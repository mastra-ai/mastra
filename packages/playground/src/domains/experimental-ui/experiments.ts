import type { UIExperimentConfig } from './experimental-ui-context';

export const UI_EXPERIMENTS: UIExperimentConfig[] = [
  {
    key: 'entity-list-page',
    name: 'Entity List page UI',
    path: ['/agents', '/prompts', '/tools', '/datasets', '/scorers', '/mcps', '/workflows', '/processors'],
    variants: [
      { value: 'current', label: 'Current state' },
      { value: 'new-proposal', label: 'New proposal' },
    ],
  },
];
