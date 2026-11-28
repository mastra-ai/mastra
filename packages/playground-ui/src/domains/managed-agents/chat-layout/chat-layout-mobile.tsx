import type { ChatLayoutViewProps } from './chat-layout-types';
import { SideDrawer } from './side-drawer';

export function ChatLayoutMobile({
  threads,
  threadsOpen,
  onThreadsOpenChange = () => undefined,
  details,
  detailsOpen,
  onDetailsOpenChange,
  children,
}: ChatLayoutViewProps) {
  return (
    <div data-slot="chat-layout" className="relative flex h-full min-h-0 flex-col">
      {children}
      {threads ? (
        <SideDrawer side="left" title="Threads" open={threadsOpen} onOpenChange={onThreadsOpenChange}>
          {threads}
        </SideDrawer>
      ) : null}
      {details ? (
        <SideDrawer side="right" title="Details" open={detailsOpen} onOpenChange={onDetailsOpenChange}>
          {details}
        </SideDrawer>
      ) : null}
    </div>
  );
}
