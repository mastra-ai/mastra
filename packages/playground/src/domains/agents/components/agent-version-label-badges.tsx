import { Button } from '@mastra/playground-ui/components/Button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@mastra/playground-ui/components/Popover';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { AgentVersionLabelBadge } from './agent-version-label-badge';

const PRODUCTION_LABEL = 'production';
const LATEST_LABEL = 'latest';
const MAX_VISIBLE_LABELS = 4;

function compareAscii(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function getCustomLabels(labels: readonly string[]): string[] {
  return Array.from(new Set(labels))
    .filter(label => label !== PRODUCTION_LABEL && label !== LATEST_LABEL)
    .sort(compareAscii);
}

function orderLabels(labels: readonly string[]): string[] {
  const uniqueLabels = new Set(labels);
  const customLabels = getCustomLabels(labels);

  return [
    ...(uniqueLabels.has(PRODUCTION_LABEL) ? [PRODUCTION_LABEL] : []),
    ...customLabels,
    ...(uniqueLabels.has(LATEST_LABEL) ? [LATEST_LABEL] : []),
  ];
}

function splitLabels(labels: readonly string[]): { visible: string[]; hidden: string[] } {
  const uniqueLabels = new Set(labels);
  const customLabels = getCustomLabels(labels);
  const reservedCount = Number(uniqueLabels.has(PRODUCTION_LABEL)) + Number(uniqueLabels.has(LATEST_LABEL));
  const visibleCustomLabels = customLabels.slice(0, MAX_VISIBLE_LABELS - reservedCount);
  const hiddenCustomLabels = customLabels.slice(visibleCustomLabels.length);

  return {
    visible: orderLabels([
      ...(uniqueLabels.has(PRODUCTION_LABEL) ? [PRODUCTION_LABEL] : []),
      ...visibleCustomLabels,
      ...(uniqueLabels.has(LATEST_LABEL) ? [LATEST_LABEL] : []),
    ]),
    hidden: hiddenCustomLabels,
  };
}

export interface AgentVersionLabelBadgesProps {
  labels: readonly string[];
  versionNumber: number;
}

export function AgentVersionLabelBadges({ labels, versionNumber }: AgentVersionLabelBadgesProps) {
  const { visible, hidden } = splitLabels(labels);
  if (visible.length === 0) return null;

  const versionName = `v${versionNumber}`;
  const overflowLabel = `Show ${hidden.length} more labels for version ${versionName}`;
  const visibleBeforeLatest = visible.filter(label => label !== LATEST_LABEL);
  const hasLatest = visible.includes(LATEST_LABEL);

  return (
    <div
      role="list"
      aria-label={`Labels for version ${versionName}`}
      className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1"
    >
      {visibleBeforeLatest.map(label => (
        <AgentVersionLabelBadge key={label} label={label} />
      ))}

      {hidden.length > 0 ? (
        <div role="listitem" aria-label={`${hidden.length} additional version labels`}>
          <Popover>
            <PopoverTrigger
              render={
                <Button type="button" variant="outline" size="xs" aria-label={overflowLabel}>
                  +{hidden.length}
                </Button>
              }
            />
            <PopoverContent align="end" className="max-w-64">
              <Txt variant="ui-xs" className="text-neutral3">
                More labels for {versionName}
              </Txt>
              <div
                role="list"
                aria-label={`More labels for version ${versionName}`}
                className="mt-2 flex max-w-full flex-wrap gap-1"
              >
                {hidden.map(label => (
                  <AgentVersionLabelBadge key={label} label={label} />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      ) : null}

      {hasLatest ? <AgentVersionLabelBadge label={LATEST_LABEL} /> : null}
    </div>
  );
}
