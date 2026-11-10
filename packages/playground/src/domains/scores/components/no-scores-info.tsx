import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { IconPlusLarge } from '@mastra/playground-ui/icons/central/IconPlusLarge';
import { IconSquareArrowTopRight } from '@mastra/playground-ui/icons/central/IconSquareArrowTopRight';

export const NoScoresInfo = ({ onRunExperiment }: { onRunExperiment?: () => void }) => (
  <EmptyState
    titleSlot="No scores yet"
    descriptionSlot="Scores will appear here once a scorer evaluates agents or workflows. More info in the documentation."
    actionSlot={
      <div className="flex flex-col items-center gap-2">
        {onRunExperiment && (
          <Button variant="primary" onClick={onRunExperiment} icon={<IconPlusLarge />}>
            New experiment
          </Button>
        )}
        <Button
          variant="ghost"
          render={<a href="https://mastra.ai/en/docs/evals/overview" target="_blank" rel="noopener noreferrer" />}

          icon={<IconSquareArrowTopRight />}
        >
          Scorers documentation
        </Button>
      </div>
    }
    variant="fill"
  />
);
