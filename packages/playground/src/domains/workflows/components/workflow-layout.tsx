import { CollapsiblePanel, PanelSeparator } from '@mastra/playground-ui';
import { Panel, useDefaultLayout, Group } from 'react-resizable-panels';

export interface WorkflowLayoutProps {
  workflowId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export const WorkflowLayout = ({ workflowId, children, leftSlot, rightSlot }: WorkflowLayoutProps) => {
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: `workflow-layout-v2-${workflowId}`,
    storage: localStorage,
  });

  return (
    <Group className="h-full min-h-0 w-full min-w-0" defaultLayout={defaultLayout} onLayoutChange={onLayoutChange}>
      {leftSlot && (
        <>
          <CollapsiblePanel
            direction="left"
            id="left-slot"
            minSize={200}
            maxSize={'30%'}
            defaultSize={200}
            collapsedSize={60}
            collapsible={true}
            className="min-w-0"
          >
            {leftSlot}
          </CollapsiblePanel>
          <PanelSeparator />
        </>
      )}
      <Panel id="main-slot" className="min-w-0 overflow-y-auto">
        {children}
      </Panel>
      {rightSlot && (
        <>
          <PanelSeparator />
          <CollapsiblePanel
            direction="right"
            id="right-slot"
            minSize={300}
            maxSize={'50%'}
            defaultSize={300}
            collapsedSize={60}
            collapsible={true}
            className="min-w-0"
          >
            {rightSlot}
          </CollapsiblePanel>
        </>
      )}
    </Group>
  );
};
