import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import { IconSquareArrowTopRight } from '@/ds/icons/central/IconSquareArrowTopRight';

export const NoExperimentsInfo = ({ onRunExperiment }: { onRunExperiment?: () => void }) => (
  <EmptyState
    titleSlot="No Experiments yet"
    descriptionSlot={
      <>
        Run an experiment from a dataset to evaluate <br />
        your agents and workflows.
      </>
    }
    actionSlot={
      <div className="flex flex-col items-center gap-2">
        {onRunExperiment && (
          <Button variant="primary" onClick={onRunExperiment} icon={<IconPlusMedium />}>
            New experiment
          </Button>
        )}
        <Button
          variant="ghost"
          render={<a href="https://mastra.ai/docs/evals/experiments" target="_blank" rel="noopener noreferrer" />}

          icon={<IconSquareArrowTopRight />}
        >
          Experiments documentation
        </Button>
      </div>
    }
    variant="fill"
  />
);
