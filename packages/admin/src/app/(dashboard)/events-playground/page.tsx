import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

import EventDetail from '@/domains/playground/components/event-detail';
import { EventPlaygroundSidebar } from '@/domains/playground/components/events-list';

function ActionsPlayground() {
  return (
    <section className="flex h-full w-full overflow-hidden">
      <ScrollArea
        className="grow bg-[url(/images/workflow-bg.svg)]"
        viewportClassName="kepler-workflows-scroll-area scroll-mb-6"
      >
        <EventDetail />
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <aside className="border-border bg-kpl-bg-2 m-2 w-[24rem] shrink-0 rounded-[0.3125rem] border-[0.5px]">
        <div className="flex h-full flex-col">
          <EventPlaygroundSidebar />
        </div>
      </aside>
    </section>
  );
}

export default ActionsPlayground;
