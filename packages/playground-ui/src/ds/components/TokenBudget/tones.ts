export const toneClass = {
  messages: 'text-info-fg',
  memory: 'text-badge-purple-fg',
  warning: 'text-warning-fg',
} as const;

export type TokenBudgetTone = keyof typeof toneClass;
