import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { CircleSlashIcon, ExternalLinkIcon } from 'lucide-react';

export const NoPromptBlocksInfo = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<CircleSlashIcon />}
      titleSlot="No Prompt Blocks yet"
      descriptionSlot={
        <>
          Create reusable prompt blocks that can be <br />
          referenced in your agent instructions.
        </>
      }
      actionSlot={
        <Button
          variant="ghost"
          as="a"
          href="https://mastra.ai/docs/agents/agent-instructions#prompt-blocks"
          target="_blank"
          rel="noopener noreferrer"
        >
          Prompts Documentation <ExternalLinkIcon />
        </Button>
      }
    />
  </div>
);
