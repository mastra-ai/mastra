export const toneClass = {
  messages: 'text-chart-blue',
  memory: 'text-chart-purple',
  warning: 'text-warning-foreground',
} as const;

export type TokenBudgetTone = keyof typeof toneClass;
