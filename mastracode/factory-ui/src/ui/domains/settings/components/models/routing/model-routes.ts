import type { LucideIcon } from 'lucide-react';

import type { FactoryModelScope, FactoryProjectPayload } from '../../../../workspaces/services/github';
import { IconBuildings } from '@mastra/playground-ui/icons/central/IconBuildings';
import { IconChatBubbles } from '@mastra/playground-ui/icons/central/IconChatBubbles';
import { IconCirclePerson } from '@mastra/playground-ui/icons/central/IconCirclePerson';
import { IconKanbanView } from '@mastra/playground-ui/icons/central/IconKanbanView';

export type ModelLane = 'chats' | 'runs';
export type ModelDefaults = 'personal' | 'factory';

export const MODEL_LANES: readonly ModelLane[] = ['chats', 'runs'];

export const MODEL_ROUTES: Record<FactoryModelScope, Record<ModelLane, ModelDefaults>> = {
  user: { chats: 'personal', runs: 'personal' },
  hybrid: { chats: 'personal', runs: 'factory' },
  factory: { chats: 'factory', runs: 'factory' },
};

export const MODEL_SCOPE_LABELS: Record<FactoryModelScope, string> = {
  user: 'Personal',
  hybrid: 'Hybrid',
  factory: 'Factory',
};

export const MODEL_DEFAULTS_LABELS: Record<ModelDefaults, string> = {
  personal: 'Personal defaults',
  factory: 'Factory defaults',
};

export const MODEL_DEFAULTS_UNUSED_NOTE = 'Not used in this scope';

export const MODEL_DEFAULTS_ICONS: Record<ModelDefaults, LucideIcon> = {
  personal: IconCirclePerson,
  factory: IconBuildings,
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
  chats: IconChatBubbles,
  runs: IconKanbanView,
};

export function savedModelScope(project: Pick<FactoryProjectPayload, 'modelScope'>): FactoryModelScope {
  return project.modelScope ?? 'hybrid';
}

export function lanesUsing(scope: FactoryModelScope, defaults: ModelDefaults): ModelLane[] {
  return MODEL_LANES.filter(lane => MODEL_ROUTES[scope][lane] === defaults);
}

export function defaultsInUse(scope: FactoryModelScope, defaults: ModelDefaults): boolean {
  return lanesUsing(scope, defaults).length > 0;
}

export function connectorPath(fromX: number, fromY: number, toX: number, toY: number): string {
  const midX = (fromX + toX) / 2;
  return `M${fromX} ${fromY} C${midX} ${fromY} ${midX} ${toY} ${toX} ${toY}`;
}
