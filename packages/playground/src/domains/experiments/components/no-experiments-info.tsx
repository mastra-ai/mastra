import { Button, EmptyState } from '@mastra/playground-ui';
import { CircleSlashIcon, ExternalLinkIcon } from 'lucide-react';

export const NoExperimentsInfo = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<CircleSlashIcon />}
      titleSlot="No Experiments yet"
      descriptionSlot={
        <>
          Run an experiment from a dataset to evaluate <br />
          your agents and workflows.
        </>
      }
      actionSlot={
        <div className="flex flex-col items-center gap-2">
          <Button
            variant="ghost"
            as="a"
            href="https://mastra.ai/en/docs/evals/datasets/running-experiments"
            target="_blank"
            rel="noopener noreferrer"
          >
            Experiments Documentation <ExternalLinkIcon />
          </Button>
        </div>
      }
    />
  </div>
);
