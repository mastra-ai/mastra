import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ExternalLinkIcon } from 'lucide-react';

export const NoToolsInfo = () => (
  <EmptyState
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
        render={
          <a href="https://mastra.ai/docs/agents/using-tools-and-mcp" target="_blank" rel="noopener noreferrer" />
        }

        icon={<ExternalLinkIcon />}
      >
        Tools Documentation
      </Button>
    }
    variant="fill"
  />
);
