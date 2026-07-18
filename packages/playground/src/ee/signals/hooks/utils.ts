import type { getEntityLearningConfig } from '../entity-learning-api';

export function requireEntityLearningConfig(config: ReturnType<typeof getEntityLearningConfig>) {
  if (!config) throw new Error('Agent Learning is not configured');
  return config;
}
