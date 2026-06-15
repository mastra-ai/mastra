import type { ReactNode } from 'react';
import { PanelEdgeIcon } from './panel-edge-icon';
import { panelIconButtonClass } from './panel-icon-button';
import {
  Drawer,
  DrawerBackdrop,
  DrawerPopup,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
  DrawerViewport,
} from '@/ds/components/Drawer';
import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';

export interface PanelDrawerProps {
  direction: 'left' | 'right';
  /** Accessible name for the trigger button and the drawer. */
  label: string;
  children: ReactNode;
}

export const PanelDrawer = ({ direction, label, children }: PanelDrawerProps) => {
  return (
    <Drawer side={direction}>
      <DrawerTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(panelIconButtonClass, 'absolute top-2 z-10', direction === 'left' ? 'left-2' : 'right-2')}
        >
          <Icon>
            <PanelEdgeIcon side={direction} />
          </Icon>
        </button>
      </DrawerTrigger>

      <DrawerPortal keepMounted>
        <DrawerBackdrop />
        <DrawerViewport>
          <DrawerPopup className="w-[calc(100vw-2.5rem)] max-w-[28rem]">
            <DrawerTitle className="sr-only">{label}</DrawerTitle>
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </DrawerPopup>
        </DrawerViewport>
      </DrawerPortal>
    </Drawer>
  );
};
