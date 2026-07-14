import { Panel } from 'react-resizable-panels';
import { CollapsiblePanel } from '@/lib/resize/collapsible-panel';
import { PanelGroup } from '@/lib/resize/panel-group';
import { PanelSeparator } from '@/lib/resize/separator';

export interface TopicsLayoutProps {
  sidebar?: React.ReactNode;
  children?: React.ReactNode;
  tracePanel?: React.ReactNode;
  contentPadding?: boolean;
}

export function TopicsLayout({ sidebar, children, tracePanel, contentPadding = true }: TopicsLayoutProps) {
  const hasContent = Boolean(children || tracePanel);

  return (
    <div className="flex h-full min-h-0 bg-surface2 text-neutral4">
      {sidebar ? <aside className="w-88 min-h-0 shrink-0 border-r border-border1">{sidebar}</aside> : null}
      {hasContent ? (
        <main className={contentPadding ? 'min-w-0 flex-1 p-4' : 'min-w-0 flex-1'}>
          <PanelGroup className="size-full min-h-0 min-w-0" orientation="horizontal">
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
          </PanelGroup>
        </main>
      ) : null}
    </div>
  );
}
