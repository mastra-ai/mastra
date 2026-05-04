import { Button, EmptyState } from '@mastra/playground-ui';
import { CogIcon, ExternalLinkIcon } from 'lucide-react';

export const WorkspaceNotConfigured = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<CogIcon />}
      titleSlot="Workspace Not Configured"
      descriptionSlot={
        <>
          No workspace is configured. Add a workspace to your <br />
          Mastra configuration to manage files, skills, and enable semantic search.
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
