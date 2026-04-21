import { Button, EmptyState } from '@mastra/playground-ui';
import { CircleSlashIcon, ExternalLinkIcon } from 'lucide-react';

export const NoWorkflowsInfo = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<CircleSlashIcon />}
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
          as="a"
          href="https://mastra.ai/docs/workflows/overview"
          target="_blank"
          rel="noopener noreferrer"
        >
          Workflows Documentation <ExternalLinkIcon />
        </Button>
      }
    />
  </div>
);
