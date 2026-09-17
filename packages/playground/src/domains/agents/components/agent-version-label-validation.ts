export type CustomLabelValidationResult = { valid: true } | { valid: false; message: string };

/** Validates exactly what the operator typed. Studio never trims, folds, or rewrites labels. */
export function validateCustomVersionLabel(
  label: string,
  existingLabels: readonly string[],
): CustomLabelValidationResult {
  const lowercaseLabel = label.toLowerCase();
  if (lowercaseLabel === 'latest' || lowercaseLabel === 'production') {
    return { valid: false, message: 'latest and production are reserved labels.' };
  }

  if (!/^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/.test(label)) {
    return {
      valid: false,
      message:
        'Use 1–64 lowercase ASCII letters, numbers, dots, underscores, or hyphens; start and end with a letter or number.',
    };
  }

  if (existingLabels.some(existingLabel => existingLabel === label)) {
    return { valid: false, message: `The ${label} label already exists. Choose a different name.` };
  }

  return { valid: true };
}
