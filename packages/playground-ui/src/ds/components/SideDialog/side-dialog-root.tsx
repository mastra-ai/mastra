import { Dialog } from '@base-ui/react/dialog';
import { ChevronsRightIcon } from 'lucide-react';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type SideDialogRootProps = {
  variant?: 'default' | 'confirmation';
  dialogTitle: string;
  dialogDescription: string;
  isOpen: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
  level?: 1 | 2 | 3;
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
}: SideDialogRootProps) {
  const isConfirmation = variant === 'confirmation';

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose?.();
      }}
    >
      <Dialog.Portal>
        {!isConfirmation && (
          <Dialog.Backdrop
            className={cn(
              'bg-overlay backdrop-blur-sm top-0 bottom-0 right-0 left-0 fixed z-50',
              'opacity-100 transition-opacity duration-200 ease-out motion-reduce:transition-none',
              'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 data-[ending-style]:duration-150 data-[ending-style]:ease-in',
            )}
          />
        )}
        <Dialog.Popup
          className={cn(
            'fixed top-0 bottom-0 right-0 border-l border-border2 z-50 bg-surface2',
            'data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:slide-out-to-right-1/4 data-[closed]:duration-200',
            {
              'w-[75vw] 2xl:w-[65vw] 4xl:w-[55vw]': level === 1,
              'w-[70vw] 2xl:w-[59vw] 4xl:w-[48vw]': level === 2,
              'w-[65vw] 2xl:w-[53vw] 4xl:w-[41vw]': level === 3,
              'data-[open]:animate-in data-[open]:fade-in-0 data-[open]:slide-in-from-right-1/4 data-[open]:duration-300 shadow-dialog':
                !isConfirmation,
              'bg-surface2/70 backdrop-blur-sm': isConfirmation,
            },
            className,
          )}
        >
          <Dialog.Title className="sr-only">{dialogTitle}</Dialog.Title>
          <Dialog.Description className="sr-only">{dialogDescription}</Dialog.Description>

          {!isConfirmation && (
            <Dialog.Close
              render={
                <button
                  type="button"
                  className={cn(
                    'flex appearance-none items-center justify-center rounded-bl-lg h-14 w-14 absolute top-0 -left-14 bg-surface2 text-neutral3 border-l border-b border-border2',
                    transitions.all,
                    'hover:bg-surface4 hover:text-neutral5',
                  )}
                  aria-label="Close"
                >
                  <ChevronsRightIcon />
                </button>
              }
            />
          )}

          <div
            className={cn('grid h-full', {
              'grid-rows-[auto_1fr]': !isConfirmation,
            })}
          >
            {children}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
