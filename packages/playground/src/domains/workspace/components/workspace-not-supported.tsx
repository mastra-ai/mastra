import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ExternalLinkIcon } from 'lucide-react';

export const WorkspaceNotSupported = () => (
  <EmptyState
    titleSlot="Workspace Not Supported"
    descriptionSlot={
      <>
        The workspace feature requires a newer version of <code className="text-foreground">@mastra/core</code>.
        <br />
        Please upgrade your dependencies to enable workspace functionality.
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
