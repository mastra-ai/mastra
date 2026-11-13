import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { IconPlusLarge } from '@mastra/playground-ui/icons/central/IconPlusLarge';
import { IconSquareArrowTopRight } from '@mastra/playground-ui/icons/central/IconSquareArrowTopRight';

export interface NoDatasetsInfoProps {
  onCreateClick?: () => void;
}

export const NoDatasetsInfo = ({ onCreateClick }: NoDatasetsInfoProps = {}) => (
  <EmptyState
    titleSlot="No Datasets yet"
    descriptionSlot={
      <>
        Create your first dataset to start evaluating <br />
        your agents and workflows.
      </>
    }
    actionSlot={
      <div className="flex flex-col items-center gap-2">
        {onCreateClick && (
          <Button variant="primary" onClick={onCreateClick} icon={<IconPlusLarge />}>
            New dataset
          </Button>
        )}
        <Button
          variant="ghost"
          render={<a href="https://mastra.ai/docs/evals/datasets" target="_blank" rel="noopener noreferrer" />}

          icon={<IconSquareArrowTopRight />}
        >
          Datasets documentation
        </Button>
      </div>
    }
    variant="fill"
  />
);
