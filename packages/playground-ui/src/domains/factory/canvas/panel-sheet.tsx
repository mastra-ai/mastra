import { useState } from 'react';
import type { ReactNode } from 'react';
import { InSheet } from './panel-sheet-context';
import { Drawer, DrawerContent } from '@/ds/components/Drawer';

/**
 * The side panel on a phone: a bottom sheet over the whole canvas, toolbar included. Swiped down, or dismissed with a
 * tap outside or Escape, it slides away first and closes the panel once it's gone. A panel closing itself unmounts it.
 */
export function PanelSheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={stillOpen => {
        if (!stillOpen) onClose();
      }}
    >
      <DrawerContent showCloseButton={false}>
        <InSheet.Provider value>{children}</InSheet.Provider>
      </DrawerContent>
    </Drawer>
  );
}
