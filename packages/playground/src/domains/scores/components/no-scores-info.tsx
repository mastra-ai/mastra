import { Button, EmptyState } from '@mastra/playground-ui';
import { CircleSlashIcon, ExternalLinkIcon } from 'lucide-react';

export const NoScoresInfo = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<CircleSlashIcon />}
      titleSlot="No scores yet"
      descriptionSlot="Scores will appear here once a scorer evaluates agents or workflows. More info in the documentation."
      actionSlot={
        <Button
          variant="ghost"
          as="a"
          href="https://mastra.ai/en/docs/evals/overview"
          target="_blank"
          rel="noopener noreferrer"
        >
          Scorers Documentation <ExternalLinkIcon />
        </Button>
      }
    />
  </div>
);
