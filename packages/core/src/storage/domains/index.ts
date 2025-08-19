export * from './scores';
export * from './operations';
export * from './workflows';
export * from './traces';
export * from './memory';
export * from './legacy-evals';

export function safelyParseJSON(jsonParam: any): any {
  // If already an object (and not null), return as-is
  if (jsonParam && typeof jsonParam === 'object') {
    return jsonParam;
  }
  // If null or undefined, return empty object
  if (jsonParam == null) {
    return {};
  }
  // If it's a string, try to parse
  if (typeof jsonParam === 'string') {
    try {
      return JSON.parse(jsonParam);
    } catch {
      console.error('Failed to parse JSON string');
      console.error(jsonParam);
      return {};
    }
  }
  // For anything else (number, boolean, etc.), return empty object
  return {};
}
