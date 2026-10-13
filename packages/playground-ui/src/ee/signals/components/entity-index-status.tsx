import type { ThemeLearningEntity } from '@mastra/client-js';

import { entityStatusLabel, waitingForTracesDescription } from './entity-index-model';
import { Badge } from '@/ds/components/Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';

export function EntityIndexStatus({ entity }: { entity: ThemeLearningEntity }) {
  const label = entityStatusLabel(entity.status);
  const variant = entity.status === 'ready' ? 'success' : entity.status === 'processing' ? 'info' : 'neutral';
  const badge = (
    <Badge variant={variant} size="sm" indicator={entity.status === undefined ? undefined : 'dot'}>
      {label}
    </Badge>
  );
  if (entity.status !== 'collecting') return badge;

  // Waiting agents have no detail page to open, so the badge carries the explanation.
  const description = waitingForTracesDescription(entity.traceCount);
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} className="pointer-events-auto inline-flex rounded-full" />}>
        {badge}
        <span className="sr-only">{description}</span>
      </TooltipTrigger>
      <TooltipContent>{description}</TooltipContent>
    </Tooltip>
  );
}
