import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { CircleSlashIcon, ExternalLinkIcon, Plus } from 'lucide-react';

export interface NoDatasetInfoProps {
  onCreateClick?: () => void;
}

export const NoDatasetInfo = ({ onCreateClick }: NoDatasetInfoProps) => (
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
        <div className="grid gap-3 justify-items-center">
          {onCreateClick && (
            <Button onClick={onCreateClick}>
              <Plus />
              Create Dataset
            </Button>
          )}
          <Button
            variant="ghost"
            as="a"
            href="https://mastra.ai/docs/observability/datasets/overview"
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
