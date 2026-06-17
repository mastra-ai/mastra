import { Panel, Group } from 'react-resizable-panels';
import { CollapsiblePanel } from '@/lib/resize/collapsible-panel';
import { PanelSeparator } from '@/lib/resize/separator';

export interface TopicsLayoutProps {
  sidebar?: React.ReactNode;
  children?: React.ReactNode;
  tracePanel?: React.ReactNode;
}

export function TopicsLayout({ sidebar, children, tracePanel }: TopicsLayoutProps) {
  const hasContent = Boolean(children || tracePanel);

  return (
    <div className="flex h-full min-h-0 bg-surface2 text-neutral4">
      {sidebar ? <aside className="min-h-0 w-[22rem] shrink-0 border-r border-border1">{sidebar}</aside> : null}
      {hasContent ? (
        <main className="min-w-0 flex-1 p-4">
          <Group className="h-full min-h-0 w-full min-w-0" direction="horizontal">
            {children ? (
              <Panel id="topic-main" className="min-w-0 pr-2" minSize={35}>
                {children}
              </Panel>
            ) : null}
            {tracePanel ? (
              <>
                {children ? <PanelSeparator /> : null}
                <CollapsiblePanel
                  direction="right"
                  id="topic-trace-details"
                  minSize={300}
                  maxSize="70%"
                  defaultSize={children ? '40%' : '100%'}
                  collapsedSize={60}
                  collapsible
                  className="min-w-0 pl-2"
                >
                  {tracePanel}
                </CollapsiblePanel>
              </>
            ) : null}
          </Group>
        </main>
      ) : null}
    </div>
  );
}
