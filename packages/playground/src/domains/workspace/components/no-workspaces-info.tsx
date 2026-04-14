import { Button, EmptyState } from '@mastra/playground-ui';
import { CircleSlashIcon, ExternalLinkIcon } from 'lucide-react';

export const NoWorkspacesInfo = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<CircleSlashIcon />}
      titleSlot="No Workspaces yet"
      descriptionSlot={
        <>
          Add a workspace to your Mastra configuration to <br />
          manage files, skills, and enable semantic search.
        </>
      }
      actionSlot={
        <Button
          variant="ghost"
          as="a"
          href="https://mastra.ai/en/docs/workspace/overview"
          target="_blank"
          rel="noopener noreferrer"
        >
          Workspaces Documentation <ExternalLinkIcon />
        </Button>
      }
    />
  </div>
);
