import type { FactoryProjectPayload } from '../../../services/github';

export const factorySwitcherProjects = [
  { id: 'factory-current', name: 'Current Factory' },
  { id: 'factory-next', name: 'Next Factory' },
] satisfies FactoryProjectPayload[];
