import { customAlphabet } from 'nanoid';

/** Short random id that keeps default names apart, e.g. "a3f9". */
export const createNameSuffix = customAlphabet('0123456789abcdef', 4);

/** Builds the default experiment name from the target name, e.g. "Mastra Docs" → "mastra-docs-a3f9". */
export function buildDefaultExperimentName(targetName: string, suffix: string) {
  const slug = targetName
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

  return `${slug || 'experiment'}-${suffix}`;
}
