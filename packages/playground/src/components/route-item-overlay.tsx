import { PanelSeparator } from '@mastra/playground-ui/resize/separator';
import { Group, Panel } from 'react-resizable-panels';

export type RouteItemOverlayProps = {
  /** Accessible label for the floating dialog. */
  label: string;
  children: React.ReactNode;
};

/**
 * Floating side panel for `items/:itemId` child routes. The overlay spans the
 * parent area but stays click-through except for the panel and its resize
 * separator, so the list beneath remains interactive. The panel itself is
 * transparent — the cards inside carry the visible rounded frames.
 */
export function RouteItemOverlay({ label, children }: RouteItemOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <Group
        orientation="horizontal"
        className="h-full w-full [&_[role=separator]]:pointer-events-auto"
        style={{ height: '100%' }}
      >
        {/* Click-through spacer; its minSize bounds the panel to half the page. */}
        <Panel id="item-overlay-spacer" minSize="50%" className="pointer-events-none h-full" />
        <PanelSeparator variant="pill" />
        <Panel
          id="item-overlay-panel"
          minSize={384}
          maxSize="50%"
          defaultSize={640}
          className="pointer-events-auto h-full min-h-0 min-w-0"
        >
          <div role="dialog" data-item-panel aria-label={label} className="h-full w-full overflow-y-auto">
            {children}
          </div>
        </Panel>
      </Group>
    </div>
  );
}
