export * from './scores';
export * from './operations';
export * from './workflows';
export * from './traces';
export * from './memory';
export * from './legacy-evals';

export function safelyParseJSON(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch {
    return {};
  }
}
