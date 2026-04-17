import { Button, EmptyState } from '@mastra/playground-ui';
import { CircleSlashIcon, ExternalLinkIcon } from 'lucide-react';

export const NoScorersInfo = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<CircleSlashIcon />}
      titleSlot="No Scorers yet"
      descriptionSlot="Configure scorers in code to get started. More info in the documentation."
      actionSlot={
        <Button
          variant="ghost"
          as="a"
          href="https://mastra.ai/docs/evals/overview"
          target="_blank"
          rel="noopener noreferrer"
        >
          Scorers Documentation <ExternalLinkIcon />
        </Button>
      }
    />
  </div>
);
