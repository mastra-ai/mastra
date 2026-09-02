export const toneClass = {
  messages: 'text-info',
  memory: 'text-purple-9',
  warning: 'text-warning',
} as const;

export type TokenBudgetTone = keyof typeof toneClass;
