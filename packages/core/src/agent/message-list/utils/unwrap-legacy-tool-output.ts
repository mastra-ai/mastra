/** Unwraps the legacy raw UI tool-output shape only when `value` is its sole enumerable key. */
export function unwrapLegacyToolOutput(output: unknown): unknown {
  if (output === null || typeof output !== 'object') return output;

  const keys = Object.keys(output);
  return keys.length === 1 && keys[0] === 'value' ? (output as { value: unknown }).value : output;
}
