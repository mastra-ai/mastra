import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { IconSquareArrowTopRight } from '@mastra/playground-ui/icons/central/IconSquareArrowTopRight';

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
