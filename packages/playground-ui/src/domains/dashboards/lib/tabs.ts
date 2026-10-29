/** A tab's value: its label in kebab case (`Tokens` → `tokens`), or its position when unlabelled. */
export const tabValue = (label: string | undefined, index: number) =>
  label ? label.trim().toLowerCase().replace(/\s+/g, '-') : String(index);
