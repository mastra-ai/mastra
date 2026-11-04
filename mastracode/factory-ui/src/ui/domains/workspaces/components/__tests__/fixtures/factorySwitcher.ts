import type { ListedFactoryProjectPayload } from '../../../services/github';

export const factorySwitcherProjects = [
  { id: 'factory-current', name: 'Current Factory', repositories: [] },
  { id: 'factory-next', name: 'Next Factory', repositories: [] },
] satisfies ListedFactoryProjectPayload[];
