import { createContext, useContext } from 'react';

export type FieldAriaIds = {
  labelId: string;
  descriptionId: string;
  errorId: string;
  controlId: string;
  invalid: boolean;
  hasDescription: boolean;
  setHasDescription: (hasDescription: boolean) => void;
};

export const FieldAriaContext = createContext<FieldAriaIds | null>(null);

export function useFieldAriaIds() {
  return useContext(FieldAriaContext);
}

// Base UI controls are wired by the Field; only non-Base-UI controls (CodeMirror) need this.
export function useFieldControlAria() {
  const field = useFieldAriaIds();
  if (!field) return {};
  const describedByIds = [field.hasDescription && field.descriptionId, field.invalid && field.errorId].filter(Boolean);
  return {
    id: field.controlId,
    'aria-labelledby': field.labelId,
    'aria-describedby': describedByIds.length > 0 ? describedByIds.join(' ') : undefined,
    'aria-invalid': field.invalid || undefined,
  };
}
