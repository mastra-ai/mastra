export function safelyParseJSON(input: any): any {
  // If already an object (and not null), return as-is
  if (input && typeof input === 'object') return input;
  if (input == null) return {};
  // If it's a string, try to parse
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch {
      return input;
    }
  }
  // For anything else (number, boolean, etc.), return empty object
  return {};
}
