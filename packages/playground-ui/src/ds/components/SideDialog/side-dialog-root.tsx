import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { ChevronsRightIcon } from 'lucide-react';
import { transitions } from '@/ds/primitives/transitions';

export type SideDialogRootProps = {
  variant?: 'default' | 'confirmation';
  dialogTitle: string;
  dialogDescription: string;
  isOpen: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
  level?: 1 | 2 | 3;
  /** When true, clicking outside won't close the dialog (useful for nested dialogs) */
  preventCloseOnOutsideClick?: boolean;
};

export function SideDialogRoot({
  dialogTitle,
  dialogDescription,
  isOpen,
  onClose,
  children,
  variant = 'default',
  level = 1,
  className,
  preventCloseOnOutsideClick = false,
}: SideDialogRootProps) {
  const isConfirmation = variant === 'confirmation';

  const handleOpenChange = (open: boolean) => {
    if (!open && onClose) {
      onClose();
    }
  };

  // Higher level dialogs get higher z-index so they're on top
  const zIndex = 50 + (level - 1) * 10;

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        {!isConfirmation && (
          <Dialog.Overlay
            className={cn('bg-black top-0 bottom-0 right-0 left-0 fixed opacity-40')}
            style={{ zIndex }}
          />
        )}
        <Dialog.Content
          className={cn(
            'fixed top-0 bottom-0 right-0 border-l border-border2 bg-surface2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 ',
            {
              'w-[75vw] 2xl:w-[65vw] 4xl:w-[55vw]': level === 1,
              'w-[70vw] 2xl:w-[59vw] 4xl:w-[48vw]': level === 2,
              'w-[65vw] 2xl:w-[53vw] 4xl:w-[41vw]': level === 3,
              'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-1/4 data-[state=open]:duration-300 shadow-dialog':
                !isConfirmation,
              'bg-surface2/70 backdrop-blur-sm': isConfirmation,
            },
            className,
          )}
          style={{ zIndex }}
          onInteractOutside={preventCloseOnOutsideClick ? e => e.preventDefault() : undefined}
          onPointerDownOutside={preventCloseOnOutsideClick ? e => e.preventDefault() : undefined}
        >
          <VisuallyHidden.Root>
            <Dialog.Title>{dialogTitle}</Dialog.Title>
            <Dialog.Description>{dialogDescription}</Dialog.Description>
          </VisuallyHidden.Root>

          {!isConfirmation && (
            <Dialog.Close asChild>
              <button
                className={cn(
                  'flex appearance-none items-center justify-center rounded-bl-lg h-[3.5rem] w-[3.5rem] absolute top-0 left-[-3.5rem] bg-surface2 text-neutral3 border-l border-b border-border2',
                  transitions.all,
                  'hover:bg-surface4 hover:text-neutral5',
                )}
                aria-label="Close"
              >
                <ChevronsRightIcon />
              </button>
            </Dialog.Close>
          )}

          <div
            className={cn('grid h-full', {
              'grid-rows-[auto_1fr]': !isConfirmation,
            })}
          >
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
