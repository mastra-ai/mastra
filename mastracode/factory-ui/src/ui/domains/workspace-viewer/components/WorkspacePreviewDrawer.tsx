import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerInteractive,
  DrawerTitle,
} from '@mastra/playground-ui/components/Drawer';
import type { ReactNode } from 'react';

export function WorkspacePreviewDrawer({
  title,
  description,
  open,
  expanded = false,
  onClose,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  expanded?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Drawer
      side="right"
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) onClose();
      }}
    >
      <DrawerContent
        className={expanded ? 'w-[calc(100vw-3.5rem)] max-w-[calc(100vw-3.5rem)]' : 'w-[85vw] max-w-[85vw]'}
      >
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <DrawerDescription className="sr-only">{description}</DrawerDescription>
        <DrawerInteractive
          render={
            <div className="flex min-h-0 flex-1 flex-col" data-testid="workspace-preview-interactive">
              {children}
            </div>
          }
        />
      </DrawerContent>
    </Drawer>
  );
}
