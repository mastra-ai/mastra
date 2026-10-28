import { ScrollArea, ScrollAreaViewport } from '@mastra/playground-ui/components/ScrollArea';

import type { ToolView } from '../activity-header';
import { callsViewKeys, useActivityView } from '../activity-view';
import { rowStyle } from '../row-style';
import { ToolRow } from './ToolRow';

export const CALLS_PANEL = `${rowStyle.content} max-w-[40rem] py-0.5 pr-0 pl-2.5`;

/** The rows of an open group of calls. Mounts only while open, and follows new rows while live. */
export function CallsPanel({ tools, live }: { tools: ToolView[]; live: boolean }) {
  const view = useActivityView(callsViewKeys(tools));

  return (
    <ScrollArea maxHeight="min(18rem, 50dvh)" revealScrollbarOnHover={false} autoScroll={live}>
      <ScrollAreaViewport className="overscroll-y-contain">
        {tools.map(member => (
          <ToolRow key={member.key} member={member} view={view} />
        ))}
      </ScrollAreaViewport>
    </ScrollArea>
  );
}
