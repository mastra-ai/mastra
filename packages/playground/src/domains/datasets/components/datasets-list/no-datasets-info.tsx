import { Button, CreateButton } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ExternalLinkIcon } from 'lucide-react';

export interface NoDatasetsInfoProps {
  onCreateClick?: () => void;
}

export const NoDatasetsInfo = ({ onCreateClick }: NoDatasetsInfoProps = {}) => (
  <EmptyState
    titleSlot="No datasets yet"
    descriptionSlot={
      <>
        Create your first dataset to start evaluating <br />
        your agents and workflows.
      </>
    }
    actionSlot={
      <div className="flex flex-col items-center gap-2">
        {onCreateClick && (
          <CreateButton variant="primary" onClick={onCreateClick} tooltip="Create a dataset">
            New dataset
          </CreateButton>
        )}
        <Button
          variant="ghost"
          render={<a href="https://mastra.ai/docs/evals/datasets" target="_blank" rel="noopener noreferrer" />}
          icon={<ExternalLinkIcon />}
        >
          Datasets Documentation
        </Button>
      </div>
    }
    variant="fill"
  />
);
