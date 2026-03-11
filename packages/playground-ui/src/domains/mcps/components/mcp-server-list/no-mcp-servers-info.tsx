import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { CircleSlashIcon, ExternalLinkIcon } from 'lucide-react';

export const NoMCPServersInfo = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<CircleSlashIcon />}
      titleSlot="No MCP Servers yet"
      descriptionSlot={
        <>
          MCP servers are not configured yet. <br />
          More information in the documentation.
        </>
      }
      actionSlot={
        <div className="grid gap-3 justify-items-center">
          <Button
            variant="ghost"
            as="a"
            href="https://mastra.ai/en/docs/tools-mcp/mcp-overview"
            target="_blank"
            rel="noopener noreferrer"
          >
            MCP Documentation <ExternalLinkIcon />
          </Button>
        </div>
      }
    />
  </div>
);
