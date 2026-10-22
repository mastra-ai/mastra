import { Building2, CircleUserRound, MessagesSquare, SquareKanban } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { FactoryModelScope } from '../../../../workspaces/services/github';

export type ModelLane = 'chats' | 'runs';
export type ModelDefaults = 'personal' | 'factory';

export const MODEL_LANES: readonly ModelLane[] = ['chats', 'runs'];

export const MODEL_ROUTES: Record<FactoryModelScope, Record<ModelLane, ModelDefaults>> = {
  user: { chats: 'personal', runs: 'personal' },
  hybrid: { chats: 'personal', runs: 'factory' },
  factory: { chats: 'factory', runs: 'factory' },
};

export const MODEL_DEFAULTS_LABELS: Record<ModelDefaults, string> = {
  personal: 'Personal defaults',
  factory: 'Factory defaults',
};

export const MODEL_DEFAULTS_ICONS: Record<ModelDefaults, LucideIcon> = {
  personal: CircleUserRound,
  factory: Building2,
};

export const MODEL_DEFAULTS_TONES: Record<ModelDefaults, string> = {
  personal: 'text-chart-purple',
  factory: 'text-chart-blue',
};

export const MODEL_LANE_LABELS: Record<ModelLane, string> = {
  chats: 'Chats',
  runs: 'Work-item runs',
};

export const MODEL_LANE_ICONS: Record<ModelLane, LucideIcon> = {
  chats: MessagesSquare,
  runs: SquareKanban,
};

export function defaultsInUse(scope: FactoryModelScope, defaults: ModelDefaults): boolean {
  return MODEL_LANES.some(lane => MODEL_ROUTES[scope][lane] === defaults);
}

export function connectorPath(fromX: number, fromY: number, toX: number, toY: number): string {
  const midX = (fromX + toX) / 2;
  return `M${fromX} ${fromY} C${midX} ${fromY} ${midX} ${toY} ${toX} ${toY}`;
}
