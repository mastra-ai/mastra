import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

function Playground() {
  return (
    <section className="flex h-full w-full overflow-hidden">
      <ScrollArea
        className="grow bg-[url(/images/workflow-bg.svg)]"
        viewportClassName="kepler-workflows-scroll-area scroll-mb-6"
      >
        <h1 className="grid place-items-center h-full">Playground</h1>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <aside className="border-border bg-arkw-bg-2 m-2 w-[24rem] shrink-0 rounded-[0.3125rem] border-[0.5px]">
        <div className="flex h-full flex-col"></div>
      </aside>
    </section>
  );
}

export default Playground;
