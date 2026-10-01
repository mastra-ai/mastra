import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { useToolDrawerParam } from '../../hooks/use-tool-drawer-param';

export interface ToolDrawerProps {
  /** The drawer's body for the tool in `?tool=`, e.g. one that loads it from the agent or MCP server. */
  children: (toolId: string) => ReactNode;
}

/** The side drawer every entry point opens a tool in, driven by `?tool=`: tool icon and name, close on the right. */
export function ToolDrawer({ children }: ToolDrawerProps) {
  const { toolId, close } = useToolDrawerParam();

  return (
    <DataPanel open={toolId !== undefined} onClose={close} title={toolId ?? ''}>
      <DataPanel.Header>
        <DataPanel.Heading>
          <Icon size="sm" className="text-muted-foreground">
            <ToolsIcon />
          </Icon>
          <span className="truncate">{toolId}</span>
        </DataPanel.Heading>
        <DataPanel.HeaderActions>
          <DataPanel.CloseButton icon="x" tooltip="Close tool" onClick={close} />
        </DataPanel.HeaderActions>
      </DataPanel.Header>
      {/* `px-3` matches the header (its `px-2` plus the heading's `px-1`), so title and body share a left edge. */}
      <DataPanel.Content className="grid content-start gap-4 px-3">
        {/* Keyed by tool, so switching tools starts the body fresh: new queries, empty form and response. */}
        {toolId && <Fragment key={toolId}>{children(toolId)}</Fragment>}
      </DataPanel.Content>
    </DataPanel>
  );
}
