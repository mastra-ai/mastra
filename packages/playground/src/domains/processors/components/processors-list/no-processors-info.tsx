import { Button, EmptyState } from '@mastra/playground-ui';
import { CircleSlashIcon, ExternalLinkIcon } from 'lucide-react';

export const NoProcessorsInfo = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<CircleSlashIcon />}
      titleSlot="No Processors yet"
      descriptionSlot="Configure processors. Add input or output processors to your agents to transform messages."
      actionSlot={
        <Button
          variant="ghost"
          as="a"
          href="https://mastra.ai/docs/agents/processors"
          target="_blank"
          rel="noopener noreferrer"
        >
          Processors Documentation <ExternalLinkIcon />
        </Button>
      }
    />
  </div>
);
