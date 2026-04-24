import { Button, EmptyState } from '@mastra/playground-ui';
import { CircleAlertIcon, ExternalLinkIcon } from 'lucide-react';

export const WorkspaceNotSupported = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<CircleAlertIcon />}
      titleSlot="Workspace Not Supported"
      descriptionSlot={
        <>
          The workspace feature requires a newer version of <code className="text-neutral5">@mastra/core</code>.
          <br />
          Please upgrade your dependencies to enable workspace functionality.
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
