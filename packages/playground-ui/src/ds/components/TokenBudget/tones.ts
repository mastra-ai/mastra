export const toneClass = {
  messages: 'text-blue-9',
  memory: 'text-purple-9',
  warning: 'text-orange-9',
} as const;

export type TokenBudgetTone = keyof typeof toneClass;
