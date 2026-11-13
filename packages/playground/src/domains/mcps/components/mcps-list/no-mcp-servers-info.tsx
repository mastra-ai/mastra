import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { IconSquareArrowTopRight } from '@mastra/playground-ui/icons/central/IconSquareArrowTopRight';

export const NoMCPServersInfo = () => (
  <EmptyState
    titleSlot="No MCP Servers yet"
    descriptionSlot={
      <>
        MCP servers are not configured yet. <br />
        More information in the documentation.
      </>
    }
    actionSlot={
      <Button
        variant="ghost"
        render={<a href="https://mastra.ai/docs/tools-mcp/mcp-overview" target="_blank" rel="noopener noreferrer" />}

        icon={<IconSquareArrowTopRight />}
      >
        MCP documentation
      </Button>
    }
    variant="fill"
  />
);
