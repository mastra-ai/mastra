import type { DatasetExperiment } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Play } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ExperimentTriggerDialog } from '@/domains/datasets/components/experiment-trigger/experiment-trigger-dialog';
import type { TargetType } from '@/domains/datasets/components/experiment-trigger/target-selector';
import { useLinkComponent } from '@/lib/framework';

export interface RerunExperimentButtonProps {
  experiment: DatasetExperiment;
}

const DIALOG_TARGET_TYPES: readonly TargetType[] = ['agent', 'workflow', 'scorer'];

/**
 * Reopens the run dialog prefilled with this experiment's dataset, version,
 * target and scorers, and navigates to the new run once it is created.
 * Request context is not persisted on experiments, so it is not prefilled.
 */
export function RerunExperimentButton({ experiment }: RerunExperimentButtonProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { paths } = useLinkComponent();

  if (!experiment.datasetId) return null;

  const initialTargetType = DIALOG_TARGET_TYPES.find(type => type === experiment.targetType);

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setOpen(true)}
        tooltip="Run this experiment again with the same configuration"
      >
        <Play />
        Rerun
      </Button>
      <ExperimentTriggerDialog
        open={open}
        onOpenChange={setOpen}
        initialDatasetId={experiment.datasetId}
        initialDatasetVersion={experiment.datasetVersion ?? undefined}
        initialTargetType={initialTargetType}
        initialTargetId={experiment.targetId ?? undefined}
        initialScorerIds={experiment.scorerIds ?? []}
        onSuccess={experimentId => void navigate(paths.experimentLink(experimentId))}
      />
    </>
  );
}
