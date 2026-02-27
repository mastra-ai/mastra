import { Button } from '@/ds/components/Button';
import { Chip } from '@/ds/components/Chip';
import type { ChipProps } from '@/ds/components/Chip';
import { TextAndIcon } from '@/ds/components/Text';
import { useLinkComponent } from '@/lib/framework';
import { LayersIcon, TargetIcon, CalendarIcon, ArrowRightIcon, ArrowLeftIcon } from 'lucide-react';
import { format } from 'date-fns';
import type { DatasetExperiment } from '@mastra/client-js';

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
  datasetId: string;
  experiment?: DatasetExperiment;
  type: 'baseline' | 'contender';
}

export function ExperimentInComparisonInfo({ datasetId, experiment, type }: ExperimentInComparisonInfoProps) {
  const { Link } = useLinkComponent();
  const { label, color, customStyle } = typeConfig[type];

  if (!experiment) {
    return null;
  }

  const createdAt = experiment.createdAt ? new Date(experiment.createdAt) : null;

  return (
    <div className={`grid border-2 border-border1 rounded-lg p-5 gap-3 ${customStyle}`}>
      <div className="flex items-center gap-3 w-full overflow-clip">
        {type === 'contender' && (
          <Chip size="small" color={color}>
            {label}
            <ArrowRightIcon />
          </Chip>
        )}

        <Button
          as={Link}
          href={`/datasets/${datasetId}/experiments/${experiment.id}`}
          variant="standard"
          size="default"
        >
          <span className="truncate min-w-0">{experiment.id}</span>
        </Button>

        {type === 'baseline' && (
          <Chip size="small" color={color}>
            <ArrowLeftIcon /> {label}
          </Chip>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-ui-sm text-neutral3">
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
