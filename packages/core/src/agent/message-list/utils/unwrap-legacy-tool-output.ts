const AI_SDK_TOOL_OUTPUT_TYPES = new Set(['text', 'json', 'error-text', 'error-json', 'content']);

/** Unwraps the legacy raw UI tool-output shape only when `value` is its sole enumerable key. */
export function unwrapLegacyToolOutput(output: unknown): unknown {
  if (output === null || typeof output !== 'object') return output;

  const keys = Object.keys(output);
  return keys.length === 1 && keys[0] === 'value' ? (output as { value: unknown }).value : output;
}

/** Normalizes documented AI SDK output wrappers and the legacy sole-key `{ value }` envelope. */
export function normalizeToolOutput(
  output: unknown,
  { unwrapContent = true }: { unwrapContent?: boolean } = {},
): { isError: boolean; output: unknown } {
  if (output === null || typeof output !== 'object') return { isError: false, output };

  const record = output as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length === 2 &&
    keys.includes('type') &&
    keys.includes('value') &&
    typeof record.type === 'string' &&
    AI_SDK_TOOL_OUTPUT_TYPES.has(record.type)
  ) {
    return {
      isError: record.type === 'error-text' || record.type === 'error-json',
      output: record.type === 'content' && !unwrapContent ? output : record.value,
    };
  }

  return { isError: false, output: unwrapLegacyToolOutput(output) };
}
