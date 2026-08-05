/** Return the first model id that contains non-whitespace characters. */
export function resolveModelId(...candidates: Array<string | undefined>): string | undefined {
  return candidates.find(candidate => candidate?.trim());
}
