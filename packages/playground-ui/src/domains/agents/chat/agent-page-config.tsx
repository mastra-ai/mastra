import type { ReactNode } from 'react';
import { useState } from 'react';
import type { AgentPageDock } from './agent-page';
import { Button } from '@/ds/components/Button';
import { Drawer, DrawerBackdrop, DrawerPopup, DrawerPortal, DrawerTitle, DrawerViewport } from '@/ds/components/Drawer';
import { Kbd } from '@/ds/components/Kbd';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { PanelEdgeIcon } from '@/lib/resize/panel-edge-icon';

export interface AgentPageConfigProps {
  dock: AgentPageDock;
  shortcut?: string;
  children: (onClose: () => void) => ReactNode;
  renderPage: (toggle: ReactNode) => ReactNode;
}

export function AgentPageConfig({ dock, shortcut, children, renderPage }: AgentPageConfigProps) {
  const mobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const open = mobile ? drawerOpen : dock.open;
  const toggle = () => (mobile ? setDrawerOpen(!drawerOpen) : dock.toggle());
  const close = () => {
    if (open) toggle();
  };
  const panel = children(close);
  const Mount = dock.Mount;

  return (
    <Drawer side="right" open={mobile && drawerOpen} onOpenChange={setDrawerOpen}>
      {renderPage(
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label="Config"
          aria-pressed={open}
          tooltip={
            <span className="inline-flex items-center gap-1.5">
              {open ? 'Hide config panel' : 'Show config panel'}
              {!mobile && shortcut && <Kbd size="xs">{shortcut}</Kbd>}
            </span>
          }
          data-testid="agent-overview-panel-toggle"
          onClick={toggle}
        >
          <PanelEdgeIcon side="right" />
        </Button>,
      )}
      {mobile ? (
        <DrawerPortal>
          <DrawerBackdrop />
          <DrawerViewport>
            <DrawerPopup className="w-[calc(100vw-2.5rem)] max-w-md">
              <DrawerTitle className="sr-only">Config</DrawerTitle>
              <div className="flex min-h-0 flex-1 flex-col">{panel}</div>
            </DrawerPopup>
          </DrawerViewport>
        </DrawerPortal>
      ) : (
        <Mount>{panel}</Mount>
      )}
    </Drawer>
  );
}
