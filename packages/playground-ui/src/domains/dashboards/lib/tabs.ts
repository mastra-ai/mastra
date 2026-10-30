/** A tab's value: its label in kebab case (`Tokens` → `tokens`), or its position when unlabelled or blank. */
export const tabValue = (label: string | undefined, index: number) => {
  const trimmed = label?.trim();
  return trimmed ? trimmed.toLowerCase().replace(/\s+/g, '-') : String(index);
};

/** A tab's visible name: its label, or `View n` when unlabelled or blank, so every tab has an accessible name. */
export const tabLabel = (label: string | undefined, index: number) => label?.trim() || `View ${index + 1}`;
