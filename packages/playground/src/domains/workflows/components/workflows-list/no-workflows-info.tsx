import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ExternalLinkIcon } from 'lucide-react';

export const NoWorkflowsInfo = () => (
  <EmptyState
    titleSlot="No Workflows yet"
    descriptionSlot={
      <>
        Mastra workflows are not configured yet. <br />
        More information in the documentation.
      </>
    }
    actionSlot={
      <Button
        variant="ghost"
        render={<a href="https://mastra.ai/docs/workflows/overview" target="_blank" rel="noopener noreferrer" />}

        icon={<ExternalLinkIcon />}
      >
        Workflows Documentation
      </Button>
    }
    variant="fill"
  />
);
