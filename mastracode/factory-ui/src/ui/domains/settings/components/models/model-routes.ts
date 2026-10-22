import type { FactoryModelScope } from '../../../workspaces/services/github';

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

export const MODEL_LANE_LABELS: Record<ModelLane, string> = {
  chats: 'Chats',
  runs: 'Work-item runs',
};

export function defaultsInUse(scope: FactoryModelScope, defaults: ModelDefaults): boolean {
  return MODEL_LANES.some(lane => MODEL_ROUTES[scope][lane] === defaults);
}

export function connectorPath(fromX: number, fromY: number, toX: number, toY: number): string {
  const midX = (fromX + toX) / 2;
  return `M${fromX} ${fromY} C${midX} ${fromY} ${midX} ${toY} ${toX} ${toY}`;
}
