/**
 * Extracts and parses JSON from a string, handling common edge cases
 * @param input - String containing JSON
 * @returns Parsed JSON object
 */
export function jsonFormatter(input: string) {
  const matches = input.match(/\{.*\}/s);
  const jsonStr = matches?.[0] ?? '{}';

  try {
    return JSON.parse(jsonStr.replace(/,(\s*[}\]])/g, '$1'));
  } catch {
    throw new Error('Invalid JSON output. Please use a better evaluation model.');
  }
}
