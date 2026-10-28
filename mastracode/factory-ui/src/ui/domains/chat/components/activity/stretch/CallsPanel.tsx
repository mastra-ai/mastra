import { ScrollArea, ScrollAreaViewport } from '@mastra/playground-ui/components/ScrollArea';
import { useLayoutEffect, useRef } from 'react';

import type { ToolView } from '../activity-header';
import { callsViewKeys, useActivityView } from '../activity-view';
import { rowStyle } from '../row-style';
import { ToolRow } from './ToolRow';

export const CALLS_PANEL = `${rowStyle.content} max-w-[40rem] py-0.5 pr-0 pl-2.5`;

/** The rows of an open group of calls. Mounts only while open, and picks up where the reader left it. */
export function CallsPanel({ tools, live }: { tools: ToolView[]; live: boolean }) {
  const view = useActivityView(callsViewKeys(tools));
  const viewportRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const { anchor } = view;
    if (!viewport || !anchor) return;
    const row = viewport.querySelector(`[data-activity-key="${CSS.escape(anchor.key)}"]`);
    if (!row) return;
    viewport.scrollTop += row.getBoundingClientRect().top - viewport.getBoundingClientRect().top - anchor.offset;
  }, [view]);

  function saveAnchor() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const top = viewport.getBoundingClientRect().top;
    const row = Array.from(viewport.querySelectorAll<HTMLElement>('[data-activity-key]')).find(
      candidate => candidate.getBoundingClientRect().bottom > top,
    );
    const key = row?.dataset.activityKey;
    if (row && key) view.anchor = { key, offset: row.getBoundingClientRect().top - top };
  }

  function rememberFollowing(following: boolean) {
    view.following = following;
  }

  return (
    <ScrollArea
      maxHeight="min(18rem, 50dvh)"
      revealScrollbarOnHover={false}
      autoScroll={live}
      autoScrollStartFollowing={view.following}
      onAutoScrollFollowingChange={rememberFollowing}
    >
      <ScrollAreaViewport ref={viewportRef} className="overscroll-y-contain" onScroll={saveAnchor}>
        {tools.map(member => (
          <div key={member.key} data-activity-key={member.key}>
            <ToolRow member={member} view={view} />
          </div>
        ))}
      </ScrollAreaViewport>
    </ScrollArea>
  );
}
