export const toneClass = {
  messages: 'text-blue-700 dark:text-blue-500',
  memory: 'text-purple-700 dark:text-purple-500',
  warning: 'text-warning-indicator',
} as const;

export type TokenBudgetTone = keyof typeof toneClass;
