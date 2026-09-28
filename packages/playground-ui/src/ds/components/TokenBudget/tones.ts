export const toneClass = {
  messages: 'text-blue-500',
  memory: 'text-purple-500',
  warning: 'text-warning-indicator',
} as const;

export type TokenBudgetTone = keyof typeof toneClass;
