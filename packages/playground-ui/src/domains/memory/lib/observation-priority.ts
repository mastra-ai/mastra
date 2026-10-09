export type ObservationPriority = 'high' | 'medium' | 'low' | 'complete';

export const observationPriorityByEmoji = {
  '🔴': 'high',
  '🟡': 'medium',
  '🟢': 'low',
  '✅': 'complete',
} as const satisfies Record<string, ObservationPriority>;

export const observationPriorityTone = {
  high: {
    card: 'border-badge-purple-edge bg-badge-purple-subtle',
    fill: 'bg-badge-purple-subtle',
    accentBorder: 'border-l-badge-purple-indicator',
    time: 'text-badge-purple-foreground',
  },
  medium: {
    card: 'border-badge-blue-edge bg-badge-blue-subtle',
    fill: 'bg-badge-blue-subtle',
    accentBorder: 'border-l-badge-blue-indicator',
    time: 'text-badge-blue-foreground',
  },
  low: {
    card: 'border-badge-cyan-edge bg-badge-cyan-subtle',
    fill: 'bg-badge-cyan-subtle',
    accentBorder: 'border-l-badge-cyan-indicator',
    time: 'text-badge-cyan-foreground',
  },
  complete: {
    card: 'border-success-edge bg-success-subtle',
    fill: 'bg-success-subtle',
    accentBorder: 'border-l-success-indicator',
    time: 'text-success-subtle-foreground',
  },
} satisfies Record<ObservationPriority, { card: string; fill: string; accentBorder: string; time: string }>;
