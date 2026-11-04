import { useState } from 'react';

import type { ActivityCall } from '../model/activity-members';
import { useDisclosureStore } from '../use-activity-disclosure';
import { keepFollowing, keepReadingRow, listRow } from './reading-row';
import { ActivityContent } from '@/ds/components/ai/activity';
import { ScrollArea, ScrollAreaViewport } from '@/ds/components/ScrollArea';

/** The rows of an open list of calls, capped and following the latest while live. */
export function CallsPanel({ calls, live }: { calls: readonly ActivityCall[]; live: boolean }) {
  const store = useDisclosureStore();
  const [rows] = useState(() => new Map<string, HTMLElement>());
  const [viewportRef] = useState(() => keepReadingRow(rows, store));
  const [onFollowingChange] = useState(() => keepFollowing(rows, store));

  return (
    <ActivityContent className="max-w-[40rem] py-0.5 pr-0 pl-2.5">
      <ScrollArea
        maxHeight="min(18rem, 50dvh)"
        revealScrollbarOnHover={false}
        autoScroll={live}
        autoScrollStartFollowing={store.isFollowing(calls.map(call => call.key))}
        onAutoScrollFollowingChange={onFollowingChange}
      >
        <ScrollAreaViewport ref={viewportRef} className="overscroll-y-contain">
          {calls.map(call => (
            <div key={call.key} ref={listRow(rows, call.key)}>
              {call.row}
            </div>
          ))}
        </ScrollAreaViewport>
      </ScrollArea>
    </ActivityContent>
  );
}
