import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ExternalLinkIcon } from 'lucide-react';

export const WorkspaceNotConfigured = () => (
  <EmptyState
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
        render={<a href="https://mastra.ai/en/docs/workspace/overview" target="_blank" rel="noopener noreferrer" />}

        icon={<ExternalLinkIcon />}
      >
        Workspaces Documentation
      </Button>
    }
    variant="fill"
  />
);
