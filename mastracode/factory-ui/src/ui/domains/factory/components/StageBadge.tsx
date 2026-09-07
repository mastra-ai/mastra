import { Badge } from '@mastra/playground-ui/components/Badge';

import { stageLabel, stageTone } from '../stages';

/** A stage as a colour first and a word second, so a list of them scans. */
export function StageBadge({ stage, live, className }: { stage: string; live?: boolean; className?: string }) {
  return (
    <Badge
      size="xs"
      variant={stageTone(stage)}
      emphasis="muted"
      className={className}
      {...(live ? { indicator: 'pulse' as const } : {})}
    >
      {stageLabel(stage)}
    </Badge>
  );
}
