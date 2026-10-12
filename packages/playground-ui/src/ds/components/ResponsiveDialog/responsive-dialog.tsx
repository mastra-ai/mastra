import * as React from 'react';

import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ds/components/Dialog';
import type { DialogSize } from '@/ds/components/Dialog';
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/ds/components/Drawer';
import { useIsMobile } from '@/hooks/use-is-mobile';

const PHONE_BREAKPOINT_PX = 640;

const IsPhoneContext = React.createContext(false);

const useIsPhone = () => React.useContext(IsPhoneContext);

export type ResponsiveDialogProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
};

// Open state lives here so crossing the breakpoint swaps Dialog ↔ Drawer without closing it.
function ResponsiveDialog({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: ResponsiveDialogProps) {
  const isPhone = useIsMobile(PHONE_BREAKPOINT_PX);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const handleOpenChange = (nextOpen: boolean) => {
    setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  const Root = isPhone ? Drawer : Dialog;

  return (
    <IsPhoneContext.Provider value={isPhone}>
      <Root open={open} onOpenChange={handleOpenChange}>
        {children}
      </Root>
    </IsPhoneContext.Provider>
  );
}

type ResponsiveDialogTriggerProps = Omit<React.ComponentProps<typeof DialogTrigger>, 'handle' | 'payload'>;

function ResponsiveDialogTrigger(props: ResponsiveDialogTriggerProps) {
  const Trigger = useIsPhone() ? DrawerTrigger : DialogTrigger;
  return <Trigger {...props} />;
}

type ResponsiveDialogCloseProps = React.ComponentProps<typeof DialogClose>;

function ResponsiveDialogClose(props: ResponsiveDialogCloseProps) {
  const Close = useIsPhone() ? DrawerClose : DialogClose;
  return <Close {...props} />;
}

export type ResponsiveDialogContentProps = {
  className?: string;
  children?: React.ReactNode;
  /** Width of the centered dialog. The phone drawer always spans the screen. */
  size?: DialogSize;
  showCloseButton?: boolean;
};

function ResponsiveDialogContent({ size, ...props }: ResponsiveDialogContentProps) {
  return useIsPhone() ? <DrawerContent {...props} /> : <DialogContent size={size} {...props} />;
}

function ResponsiveDialogHeader(props: React.ComponentProps<'div'>) {
  const Header = useIsPhone() ? DrawerHeader : DialogHeader;
  return <Header {...props} />;
}

function ResponsiveDialogBody(props: React.ComponentProps<'div'>) {
  const Body = useIsPhone() ? DrawerBody : DialogBody;
  return <Body {...props} />;
}

function ResponsiveDialogFooter(props: React.ComponentProps<'div'>) {
  const Footer = useIsPhone() ? DrawerFooter : DialogFooter;
  return <Footer {...props} />;
}

type ResponsiveDialogTitleProps = React.ComponentProps<typeof DialogTitle>;

function ResponsiveDialogTitle(props: ResponsiveDialogTitleProps) {
  const Title = useIsPhone() ? DrawerTitle : DialogTitle;
  return <Title {...props} />;
}

type ResponsiveDialogDescriptionProps = React.ComponentProps<typeof DialogDescription>;

function ResponsiveDialogDescription(props: ResponsiveDialogDescriptionProps) {
  const Description = useIsPhone() ? DrawerDescription : DialogDescription;
  return <Description {...props} />;
}

export {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
};
