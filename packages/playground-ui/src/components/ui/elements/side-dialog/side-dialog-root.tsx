import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { ChevronsRightIcon } from 'lucide-react';

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
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        {!isConfirmation && (
          <Dialog.Overlay className={cn('bg-black top-0 bottom-0 right-0 left-0 fixed z-50 opacity-40')} />
        )}
        <Dialog.Content
          className={cn(
            'fixed top-0 bottom-0 right-0 border-l border-border2 z-50 bg-surface2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 ',
            {
              'w-[75vw] 2xl:w-[65vw] 4xl:w-[55vw]': level === 1,
              'w-[70vw] 2xl:w-[59vw] 4xl:w-[48vw]': level === 2,
              'w-[65vw] 2xl:w-[53vw] 4xl:w-[41vw]': level === 3,
              'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-1/4 shadow-[-3rem_0_2rem_0_rgba(0,0,0,0.75)]':
                !isConfirmation,
              'bg-surface2/70': isConfirmation,
            },
            className,
          )}
        >
          <VisuallyHidden.Root>
            <Dialog.Title>{dialogTitle}</Dialog.Title>
            <Dialog.Description>{dialogDescription}</Dialog.Description>
          </VisuallyHidden.Root>

          {!isConfirmation && (
            <Dialog.Close asChild>
              <button
                className={cn(
                  'flex appearance-none items-center justify-center rounded-bl-lg h-[3.5rem] w-[3.5rem] absolute top-0 left-[-3.5rem] bg-surface2 text-icon4 border-l border-b border-border2',
                  'hover:surface5 hover:text-icon5',
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
