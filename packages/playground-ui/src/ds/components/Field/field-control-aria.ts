import { createContext, useContext } from 'react';

export type FieldAriaIds = {
  labelId: string;
  descriptionId: string;
  errorId: string;
  controlId: string;
  requiredId: string;
  invalid: boolean;
  required: boolean;
  setRequired: (required: boolean) => void;
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

// Base UI wires everything else from its own Field, which has no required state.
export function useFieldRequired(): { 'aria-required'?: true } {
  return useFieldAriaIds()?.required ? { 'aria-required': true } : {};
}

type FieldControlOptions = {
  /** The control's role supports `aria-required` (a textbox does, a button doesn't). Otherwise its name says it. */
  supportsRequired?: boolean;
};

// Base UI controls are wired by the Field; only non-Base-UI controls (CodeMirror) need this.
export function useFieldControlAria(
  nameProps: ControlNameProps = {},
  { supportsRequired = false }: FieldControlOptions = {},
) {
  const field = useFieldAriaIds();
  if (!field) return {};
  const labelledByIds = [field.labelId, field.required && !supportsRequired && field.requiredId].filter(Boolean);
  const describedByIds = [field.hasDescription && field.descriptionId, field.invalid && field.errorId].filter(Boolean);
  return {
    id: field.controlId,
    'aria-labelledby': hasOwnAccessibleName(nameProps) ? undefined : labelledByIds.join(' '),
    'aria-describedby': describedByIds.length > 0 ? describedByIds.join(' ') : undefined,
    'aria-invalid': field.invalid || undefined,
    'aria-required': (supportsRequired && field.required) || undefined,
  };
}
