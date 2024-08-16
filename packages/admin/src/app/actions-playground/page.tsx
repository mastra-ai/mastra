'use client';

import { useRef } from 'react';

import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

import ActionDetail from '@/domains/playground/components/action-detail';
import { ActionPlaygroundSidebar } from '@/domains/playground/components/actions-list';

function ActionsPlayground() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <section className="flex h-full w-full overflow-hidden">
      <ScrollArea
        innerRef={containerRef}
        className="grow bg-[url(/images/workflow-bg.svg)]"
        viewportClassName="kepler-workflows-scroll-area scroll-mb-6"
      >
        <div>action playground</div>
        <ActionDetail />
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <aside className="border-border bg-kp-bg-2 m-2 w-[24rem] shrink-0 rounded-[0.3125rem] border-[0.5px]">
        <div className="flex h-full flex-col">
          <ActionPlaygroundSidebar />
        </div>
      </aside>
    </section>
  );
}

export default ActionsPlayground;
