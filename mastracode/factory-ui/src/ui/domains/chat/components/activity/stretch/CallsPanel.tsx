import { ScrollArea, ScrollAreaViewport } from '@mastra/playground-ui/components/ScrollArea';
import { useState } from 'react';

import type { ToolView } from '../activity-header';
import { usePanelView } from '../activity-view';
import type { ActivityView } from '../activity-view';
import { keepReadingRow } from '../panel-row';
import { ToolRow } from './ToolRow';

export const CALLS_PANEL = 'max-w-[40rem] py-0.5 pr-0 pl-2.5';

/** The rows of an open list of calls. Mounts only while open, and picks up where the reader left it. */
export function CallsPanel({ tools, view, live }: { tools: ToolView[]; view: ActivityView; live: boolean }) {
  const panel = usePanelView(
    view,
    tools.map(({ key }) => key),
    true,
  );
  const [viewportRef] = useState(() => keepReadingRow(panel));

  return (
    <ScrollArea maxHeight="min(18rem, 50dvh)" revealScrollbarOnHover={false} autoScroll={live}>
      <ScrollAreaViewport ref={viewportRef} className="overscroll-y-contain">
        {tools.map(member => (
          <div key={member.key} data-activity-key={member.key}>
            <ToolRow member={member} view={view} />
          </div>
        ))}
      </ScrollAreaViewport>
    </ScrollArea>
  );
}
