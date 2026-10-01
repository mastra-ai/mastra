import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import type { ReactNode } from 'react';

export interface ToolDrawerProps {
  open: boolean;
  onClose: () => void;
  toolId: string;
  children: ReactNode;
}

/** The side drawer every entry point opens a tool in: tool icon and name, close on the right. */
export function ToolDrawer({ open, onClose, toolId, children }: ToolDrawerProps) {
  return (
    <DataPanel open={open} onClose={onClose} title={toolId}>
      <DataPanel.Header>
        <DataPanel.Heading>
          <Icon size="sm" className="text-muted-foreground">
            <ToolsIcon />
          </Icon>
          <span className="truncate">{toolId}</span>
        </DataPanel.Heading>
        <DataPanel.HeaderActions>
          <DataPanel.CloseButton icon="x" tooltip="Close tool" onClick={onClose} />
        </DataPanel.HeaderActions>
      </DataPanel.Header>
      {/* `px-3` matches the header (its `px-2` plus the heading's `px-1`), so title and body share a left edge. */}
      <DataPanel.Content className="grid content-start gap-4 px-3">{children}</DataPanel.Content>
    </DataPanel>
  );
}
