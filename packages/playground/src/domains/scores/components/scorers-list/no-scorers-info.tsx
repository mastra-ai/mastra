import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ExternalLinkIcon } from 'lucide-react';

export const NoScorersInfo = () => (
  <EmptyState
    titleSlot="No Scorers yet"
    descriptionSlot="Configure scorers in code to get started. More info in the documentation."
    actionSlot={
      <Button
        variant="ghost"
        render={<a href="https://mastra.ai/docs/evals/overview" target="_blank" rel="noopener noreferrer" />}

        icon={<ExternalLinkIcon />}
      >
        Scorers Documentation
      </Button>
    }
    variant="fill"
  />
);
