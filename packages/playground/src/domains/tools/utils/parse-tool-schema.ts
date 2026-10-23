import { parse } from 'superjson';

/** Tool schemas arrive superjson-stringified from the API; absent schemas stay `undefined`. */
export function parseToolSchema(serialized: string | undefined): unknown {
  if (!serialized) return undefined;
  try {
    return parse(serialized);
  } catch {
    return undefined;
  }
}
