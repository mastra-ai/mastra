import type { BoardPhaseKind } from '@mastra/factory/boards';
import { phaseIconKind } from '@mastra/playground-ui/domains/factory';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ComponentType } from 'react';

import { phaseKindOf } from '../boardFlow';
import type { BoardInfo } from '../boardFlow';
import { CARD_SOURCES } from '../cardSources';
import type { WorkItemSource } from '../services/workItems';
import { IconEyeOpen } from '@mastra/playground-ui/icons/central/IconEyeOpen';
import { IconMagnifyingGlass } from '@mastra/playground-ui/icons/central/IconMagnifyingGlass';
import { IconPlay } from '@mastra/playground-ui/icons/central/IconPlay';
import { IconHammer } from '@mastra/playground-ui/icons/central/IconHammer';
import { IconClipboard2 } from '@mastra/playground-ui/icons/central/IconClipboard2';

export {
  BoardStageIcon,
  phaseIconKind,
  stageColorClass,
  stageHeaderTintClass,
  stageStrongTintClass,
  stageTintClass,
  unfocusedStageClass,
} from '@mastra/playground-ui/domains/factory';

export function SourceIcon({ source, className }: { source: WorkItemSource; className?: string }) {
  const { Icon, iconClassName } = CARD_SOURCES[source];
  return <Icon data-source={source} className={cn('size-4 shrink-0', iconClassName, className)} aria-hidden />;
}

/** Icon for each known run-action label; `Play` is the fallback for anything else. */
const ACTION_ICONS: Record<string, ComponentType> = {
  Investigate: IconMagnifyingGlass,
  Build: IconHammer,
  'Prepare approval': IconClipboard2,
  Review: IconEyeOpen,
};

export function actionIcon(label: string) {
  const Icon = ACTION_ICONS[label] ?? IconPlay;
  return <Icon aria-hidden />;
}

export function boardPhaseIconKind(board: BoardInfo | undefined, stage: string): BoardPhaseKind | undefined {
  const kind = phaseKindOf(board, stage);
  return board && kind ? phaseIconKind(board.id, kind) : undefined;
}
