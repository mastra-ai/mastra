import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { CircleSlashIcon, ExternalLinkIcon, Play } from 'lucide-react';

export const NoExperimentsInfo = ({ onRunExperiment }: { onRunExperiment?: () => void }) => (
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
          {onRunExperiment && (
            <Button variant="primary" onClick={onRunExperiment}>
              <Play />
              Run Experiment
            </Button>
          )}
          <Button
            variant="ghost"
            as="a"
            href="https://mastra.ai/en/docs/datasets/running-experiments"
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
