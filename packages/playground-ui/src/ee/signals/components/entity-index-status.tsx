import type { ThemeLearningEntity } from '@mastra/client-js';

import { entityStatusLabel, formatEntityTraceCount } from './entity-index-model';
import { Badge } from '@/ds/components/Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export function EntityIndexStatus({ entity }: { entity: ThemeLearningEntity }) {
  if (entity.status === 'collecting') {
    const traceCount = entity.traceCount;
    const description =
      traceCount === undefined
        ? 'Waiting for completed traces. Trace count is unavailable.'
        : `${formatEntityTraceCount(traceCount)} ${traceCount === 1 ? 'trace' : 'traces'} collected. Trace signals are not available yet.`;
    return (
      <Tooltip>
        <TooltipTrigger
          render={<span />}
          role="note"
          tabIndex={0}
          className={cn('rounded-full', focusRing)}
          aria-label={`Waiting for traces for ${entity.entityId}`}
        >
          <Badge variant="neutral" size="sm" indicator="dot">
            Waiting for Traces
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{description}</TooltipContent>
      </Tooltip>
    );
  }

  const variant = entity.status === 'ready' ? 'success' : entity.status === 'processing' ? 'info' : 'neutral';
  return (
    <Badge variant={variant} size="sm" indicator={entity.status === undefined ? undefined : 'dot'}>
      {entityStatusLabel(entity.status)}
    </Badge>
  );
}
