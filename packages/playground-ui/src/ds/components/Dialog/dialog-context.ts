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
