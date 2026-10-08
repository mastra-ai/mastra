import { Button } from '@mastra/playground-ui/components/Button';
import { Sidebar, useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { Search } from 'lucide-react';
import { useContext } from 'react';
import { MobileHeaderContext } from './mobile-header-context';
import { useNavigationCommand } from '@/lib/command';

export function MobileNavbar() {
  const slots = useContext(MobileHeaderContext);
  const { setOpenMobile } = useSidebar();
  const { setOpen: setNavigationCommandOpen } = useNavigationCommand({ enableShortcut: false });

  return (
    <header
      aria-label="Studio header"
      className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-1 border-b border-surface-rim bg-sidebar px-1 lg:hidden"
    >
      <Sidebar.MobileTrigger className="shrink-0" />
      <div
        className="flex min-w-0 flex-1"
        ref={node => {
          if (node && slots) node.appendChild(slots.page);
        }}
      />
      <div
        className="contents"
        ref={node => {
          if (node && slots) node.appendChild(slots.navigation);
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-md"
        tooltip="Search"
        aria-label="Search and navigate"
        onClick={() => {
          setOpenMobile(false);
          setNavigationCommandOpen(true);
        }}
        className="size-10 shrink-0"
      >
        <Search />
      </Button>
    </header>
  );
}
