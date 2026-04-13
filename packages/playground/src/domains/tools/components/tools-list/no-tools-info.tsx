import { Button, EmptyState } from '@mastra/playground-ui';
import { CircleSlashIcon, ExternalLinkIcon } from 'lucide-react';

export const NoToolsInfo = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<CircleSlashIcon />}
      titleSlot="No Tools yet"
      descriptionSlot={
        <>
          Mastra tools are not configured yet. <br />
          More information in the documentation.
        </>
      }
      actionSlot={
        <Button
          variant="ghost"
          as="a"
          href="https://mastra.ai/docs/agents/using-tools-and-mcp"
          target="_blank"
          rel="noopener noreferrer"
        >
          Tools Documentation <ExternalLinkIcon />
        </Button>
      }
    />
  </div>
);
