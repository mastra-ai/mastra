import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { CircleSlashIcon, ExternalLinkIcon, Play } from 'lucide-react';

export const NoScoresInfo = ({ onRunExperiment }: { onRunExperiment?: () => void }) => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<CircleSlashIcon />}
      titleSlot="No scores yet"
      descriptionSlot="Scores will appear here once a scorer evaluates agents or workflows. More info in the documentation."
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
            href="https://mastra.ai/en/docs/evals/overview"
            target="_blank"
            rel="noopener noreferrer"
          >
            Scorers Documentation <ExternalLinkIcon />
          </Button>
        </div>
      }
    />
  </div>
);
