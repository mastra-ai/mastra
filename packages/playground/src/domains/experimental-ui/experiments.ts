import type { ExperimentConfig } from '@mastra/playground-ui';

export const EXPERIMENTS: ExperimentConfig[] = [
  {
    key: 'agent-list',
    name: 'Entity List page UI',
    path: ['/agents', '/prompts', '/tools', '/datasets', '/scorers', '/mcps', '/workflows', '/processors'],
    variants: [
      { value: 'current', label: 'Current state' },
      { value: 'new-proposal', label: 'New proposal' },
    ],
  },
];
