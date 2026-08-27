import type { DatasetExperiment } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Chip } from '@mastra/playground-ui/components/Chip';
import type { ChipProps } from '@mastra/playground-ui/components/Chip';
import { getShortId, TextAndIcon } from '@mastra/playground-ui/components/Text';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { format } from 'date-fns';
import { LayersIcon, TargetIcon, CalendarIcon, ArrowRightIcon, ArrowLeftIcon, HashIcon } from 'lucide-react';
import { useLinkComponent } from '@/lib/framework';

const typeConfig: Record<
  ExperimentInComparisonInfoProps['type'],
  { label: string; color: ChipProps['color']; customStyle: string }
> = {
  baseline: {
    label: 'Baseline',
    color: 'purple',
    customStyle: 'items-end justify-items-end [&>div]:justify-end border-r-0 rounded-r-none',
  },
  contender: {
    label: 'Contender',
    color: 'cyan',
    customStyle: 'items-start justify-items-start [&>div]:justify-start border-l-0 rounded-l-none',
  },
};

interface ExperimentInComparisonInfoProps {
  experiment?: DatasetExperiment;
  type: 'baseline' | 'contender';
}

export function ExperimentInComparisonInfo({ experiment, type }: ExperimentInComparisonInfoProps) {
  const { Link } = useLinkComponent();
  const { label, color, customStyle } = typeConfig[type];

  if (!experiment) {
    return null;
  }

  const createdAt = experiment.createdAt ? new Date(experiment.createdAt) : null;
  const shortId = getShortId(experiment.id) ?? experiment.id;
  const displayName = experiment.name || shortId;

  const experimentLink = (
    <Button as={Link} href={`/experiments/${experiment.id}`}>
      <span className="min-w-0 truncate">{displayName}</span>
    </Button>
  );

  return (
    <div className={`border-border1 grid gap-3 rounded-lg border-2 p-5 ${customStyle}`}>
      <div className="flex w-full items-center gap-3 overflow-clip">
        {type === 'contender' && (
          <Chip size="small" color={color}>
            {label}
            <ArrowRightIcon />
          </Chip>
        )}

        {experiment.description ? (
          <Tooltip>
            <TooltipTrigger asChild>{experimentLink}</TooltipTrigger>
            <TooltipContent>{experiment.description}</TooltipContent>
          </Tooltip>
        ) : (
          experimentLink
        )}

        {type === 'baseline' && (
          <Chip size="small" color={color}>
            <ArrowLeftIcon /> {label}
          </Chip>
        )}
      </div>

      <div className="text-ui-sm text-neutral3 flex flex-wrap gap-x-4 gap-y-1">
        {experiment.name && (
          <TextAndIcon>
            <HashIcon /> {shortId}
          </TextAndIcon>
        )}
        <TextAndIcon>
          <TargetIcon /> {experiment.targetType} / {experiment.targetId}
        </TextAndIcon>
        <TextAndIcon>
          <LayersIcon /> v{experiment.datasetVersion ?? '—'}
        </TextAndIcon>
        {createdAt && (
          <TextAndIcon>
            <CalendarIcon /> {format(createdAt, 'MMM d, yyyy HH:mm')}
          </TextAndIcon>
        )}
      </div>
    </div>
  );
}
