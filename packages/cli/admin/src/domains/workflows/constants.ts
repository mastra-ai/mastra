import type { RefinedIntegrationApi } from '@mastra/core';

export type RefinedIntegrationActionLogic = Pick<
  RefinedIntegrationApi,
  'type' | 'label' | 'icon' | 'description' | 'category'
>;

export const systemLogics: RefinedIntegrationActionLogic[] = [
  {
    type: 'CONDITIONS',
    label: 'Multibranch',
    icon: {
      alt: 'Multibranch',
      icon: 'multibranch',
    },
    description: 'Create conditional logic',
  },
];
