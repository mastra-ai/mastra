import { createContext, useContext } from 'react';

export const DialogNewContext = createContext<{ variant: 'default' | 'destructive'; pending: boolean }>({
  variant: 'default',
  pending: false,
});

export function useDialogNew() {
  return useContext(DialogNewContext);
}
