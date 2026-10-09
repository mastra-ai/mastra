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

export type ControlNameProps = {
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

export const FieldAriaContext = createContext<FieldAriaIds | null>(null);

export function useFieldAriaIds() {
  return useContext(FieldAriaContext);
}

export function hasOwnAccessibleName({ 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy }: ControlNameProps) {
  return Boolean(ariaLabel) && ariaLabelledBy === undefined;
}

export function keepOwnAccessibleName(nameProps: ControlNameProps): { 'aria-labelledby'?: undefined } {
  return hasOwnAccessibleName(nameProps) ? { 'aria-labelledby': undefined } : {};
}

// Base UI controls are wired by the Field; only non-Base-UI controls (CodeMirror) need this.
export function useFieldControlAria(nameProps: ControlNameProps = {}) {
  const field = useFieldAriaIds();
  if (!field) return {};
  const describedByIds = [field.hasDescription && field.descriptionId, field.invalid && field.errorId].filter(Boolean);
  return {
    id: field.controlId,
    'aria-labelledby': hasOwnAccessibleName(nameProps) ? undefined : field.labelId,
    'aria-describedby': describedByIds.length > 0 ? describedByIds.join(' ') : undefined,
    'aria-invalid': field.invalid || undefined,
  };
}
