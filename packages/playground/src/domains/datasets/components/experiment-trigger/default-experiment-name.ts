/** Short random id that keeps repeat runs against the same target apart, e.g. "a3f9". */
export function createExperimentNameSuffix() {
  return Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, '0');
}

/** Builds the default experiment name from the target name, e.g. "Mastra Docs" → "mastra-docs-a3f9". */
export function buildDefaultExperimentName(targetName: string, suffix: string) {
  const slug = targetName
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

  return `${slug || 'experiment'}-${suffix}`;
}
