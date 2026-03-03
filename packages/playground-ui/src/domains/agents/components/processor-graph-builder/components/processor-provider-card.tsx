import { GripVertical } from 'lucide-react';
import { Badge } from '@/ds/components/Badge';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { cn } from '@/lib/utils';
import type { ProcessorProviderInfo } from '@mastra/client-js';
import { PHASE_SHORT_LABELS } from '../utils/phase-labels';

interface ProcessorProviderCardProps {
  provider: ProcessorProviderInfo;
  isDragging: boolean;
}

export function ProcessorProviderCard({ provider, isDragging }: ProcessorProviderCardProps) {
  return (
    <div
      className={cn(
        'rounded border border-border1 bg-surface3 p-2 cursor-grab transition-shadow',
        isDragging && 'shadow-md border-accent1/50',
      )}
    >
      <div className="flex items-center gap-1">
        <Txt variant="ui-sm" className="font-medium text-neutral5 flex-1 truncate">
          {provider.name}
        </Txt>
        <Icon size="sm" className="text-neutral3 shrink-0">
          <GripVertical />
        </Icon>
      </div>
      {provider.description && (
        <Txt variant="ui-xs" className="text-neutral3 mt-0.5 line-clamp-2">
          {provider.description}
        </Txt>
      )}
      {provider.availablePhases.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {provider.availablePhases.map(phase => (
            <Badge key={phase} variant="default">
              {PHASE_SHORT_LABELS[phase] ?? phase}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
