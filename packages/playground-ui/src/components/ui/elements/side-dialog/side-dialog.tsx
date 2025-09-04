import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { ChevronsRightIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

export function SideDialog({
  dialogTitle,
  dialogDescription,
  isOpen,
  onClose,
  children,
  variant = 'default',
  hasCloseButton = true,
  className,
}: {
  variant?: 'default' | 'confirmation';
  dialogTitle: string;
  dialogDescription: string;
  isOpen: boolean;
  onClose?: () => void;
  onNext?: (() => void) | null;
  onPrevious?: (() => void) | null;
  children?: React.ReactNode;
  hasCloseButton?: boolean;
  className?: string;
}) {
  const isConfirmation = variant === 'confirmation';

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        {!isConfirmation && (
          <Dialog.Overlay className={cn('bg-black top-0 bottom-0 right-0 left-0 fixed z-50 opacity-[0.25]')} />
        )}
        <Dialog.Content
          className={cn(
            'fixed top-0 bottom-0 right-0 border-l border-border1 z-50 bg-surface4',
            'w-[calc(100vw-20rem)] max-w-[50rem]',
            '3xl:max-w-[60rem]',
            '4xl:max-w-[50%]',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
            {
              'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-1/4':
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

          {!isConfirmation && hasCloseButton && (
            <Dialog.Close asChild>
              <button
                className={cn(
                  'flex appearance-none items-center justify-center rounded-bl-lg h-[3.5rem] w-[3.5rem] absolute too-0 left-[-3.5rem] bg-surface4 text-icon4 border-l border-b border-border1',
                  'hover:surface5 hover:text-icon5',
                )}
                aria-label="Close"
              >
                {isConfirmation ? <XIcon /> : <ChevronsRightIcon />}
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
