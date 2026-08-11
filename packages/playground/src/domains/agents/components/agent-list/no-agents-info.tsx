import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { CircleSlashIcon, ExternalLinkIcon } from 'lucide-react';

export const NoAgentsInfo = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<CircleSlashIcon />}
      titleSlot="No Agents yet"
      descriptionSlot="Configure agents in code to get started."
      actionSlot={
        <Button
          variant="ghost"
          as="a"
          href="https://mastra.ai/docs/agents/overview"
          target="_blank"
          rel="noopener noreferrer"
        >
          Agents Documentation <ExternalLinkIcon />
        </Button>
      }
    />
  </div>
);
