import { Button, EmptyState } from '@mastra/playground-ui';
import { CircleSlashIcon, ExternalLinkIcon, Plus } from 'lucide-react';

export interface NoDatasetsInfoProps {
  onCreateClick?: () => void;
}

export const NoDatasetsInfo = ({ onCreateClick }: NoDatasetsInfoProps = {}) => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<CircleSlashIcon />}
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
            <Button variant="primary" onClick={onCreateClick}>
              <Plus />
              Create Dataset
            </Button>
          )}
          <Button
            variant="ghost"
            as="a"
            href="https://mastra.ai/en/docs/evals/datasets/overview"
            target="_blank"
            rel="noopener noreferrer"
          >
            Datasets Documentation <ExternalLinkIcon />
          </Button>
        </div>
      }
    />
  </div>
);
