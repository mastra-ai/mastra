export const toneClass = {
  messages: 'text-info-indicator',
  memory: 'text-badge-purple',
  warning: 'text-warning-indicator',
} as const;

export type TokenBudgetTone = keyof typeof toneClass;
