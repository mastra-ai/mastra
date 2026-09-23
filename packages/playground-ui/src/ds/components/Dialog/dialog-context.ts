import { createContext, useContext } from 'react';

export type DialogVariant = 'default' | 'new';
export type DialogIntent = 'default' | 'destructive';

export type DialogContextValue = {
  variant: DialogVariant;
  intent: DialogIntent;
  pending: boolean;
};

export const DialogContext = createContext<DialogContextValue>({
  variant: 'default',
  intent: 'default',
  pending: false,
});

export function useDialogContext() {
  return useContext(DialogContext);
}

export const dialogActionSizeClasses = {
  sm: 'min-h-control-sm',
  md: 'min-h-control-md',
  lg: 'min-h-control-lg',
} as const;

export const dialogActionLayoutClasses = 'h-auto min-w-0 max-w-full whitespace-normal wrap-anywhere max-[22rem]:w-full';
