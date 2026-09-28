import { createContext, useContext } from 'react';

export type FieldAriaIds = {
  labelId: string;
  errorId: string;
  invalid: boolean;
};

export const FieldAriaContext = createContext<FieldAriaIds | null>(null);

export function useFieldAriaIds() {
  return useContext(FieldAriaContext);
}

// Base UI controls are wired by the Field; only non-Base-UI controls (CodeMirror) need this.
export function useFieldControlAria() {
  const field = useFieldAriaIds();
  if (!field) return {};
  return {
    'aria-labelledby': field.labelId,
    'aria-describedby': field.invalid ? field.errorId : undefined,
    'aria-invalid': field.invalid || undefined,
  };
}
