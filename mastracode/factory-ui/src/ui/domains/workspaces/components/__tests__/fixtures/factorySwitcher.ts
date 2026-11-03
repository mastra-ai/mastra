import type { ProjectListRepository } from '@mastra/factory/routes/contracts';

import type { FactoryProjectPayload } from '../../../services/github';

export const factorySwitcherProjects = [
  { id: 'factory-current', name: 'Current Factory', repositories: [] },
  { id: 'factory-next', name: 'Next Factory', repositories: [] },
] satisfies Array<FactoryProjectPayload & { repositories: ProjectListRepository[] }>;
