import type { WorkItemBoardSource as WorkItemSource } from '@internal/factory-contract';
import type { ComponentType } from 'react';
import { CardSourceIcon } from '../board';

import { CARD_SOURCES } from '../board/card-sources';
import { IconClipboard2 } from '@/ds/icons/central/IconClipboard2';
import { IconEyeOpen } from '@/ds/icons/central/IconEyeOpen';
import { IconHammer } from '@/ds/icons/central/IconHammer';
import { IconMagnifyingGlass } from '@/ds/icons/central/IconMagnifyingGlass';
import { IconPlay } from '@/ds/icons/central/IconPlay';
import { cn } from '@/utils/cn';

export function SourceIcon({ source, className }: { source: WorkItemSource; className?: string }) {
  return <CardSourceIcon source={source} className={className} />;
}

/** Icon for each known run-action label; `Play` is the fallback for anything else. */
const ACTION_ICONS: Record<string, ComponentType> = {
  Investigate: IconMagnifyingGlass,
  Build: IconHammer,
  'Prepare approval': IconClipboard2,
  Review: IconEyeOpen,
};

export function ActionIcon({ label }: { label: string }) {
  const Icon = ACTION_ICONS[label] ?? IconPlay;
  return <Icon aria-hidden />;
}
