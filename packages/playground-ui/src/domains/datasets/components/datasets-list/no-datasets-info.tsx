import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { CircleSlashIcon, ExternalLinkIcon } from 'lucide-react';

export const NoDatasetsInfo = () => (
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
        <Button
          variant="ghost"
          as="a"
          href="https://mastra.ai/docs/observability/datasets/overview"
          target="_blank"
          rel="noopener noreferrer"
        >
          Datasets Documentation <ExternalLinkIcon />
        </Button>
      }
    />
  </div>
);
