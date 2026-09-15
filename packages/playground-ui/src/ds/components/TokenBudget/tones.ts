export const toneClass = {
  messages: 'text-blue-500',
  memory: 'text-violet-500',
  warning: 'text-warning1',
} as const;

export type TokenBudgetTone = keyof typeof toneClass;
