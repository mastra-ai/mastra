import type { RefinedIntegrationAction } from '@arkw/core';

export type RefinedIntegrationActionLogic = Pick<
  RefinedIntegrationAction,
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
