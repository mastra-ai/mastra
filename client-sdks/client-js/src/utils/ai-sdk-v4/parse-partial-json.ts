// Vendored from @ai-sdk/ui-utils@1.2.11 (Apache-2.0, Copyright Vercel, Inc.).
import { fixJson } from './fix-json';
import type { JSONValue } from './types';

function tryParse(text: string): { success: true; value: JSONValue } | { success: false } {
  try {
    return { success: true, value: JSON.parse(text) as JSONValue };
  } catch {
    return { success: false };
  }
}

export function parsePartialJson(jsonText: string | undefined): {
  value: JSONValue | undefined;
  state: 'undefined-input' | 'successful-parse' | 'repaired-parse' | 'failed-parse';
} {
  if (jsonText === undefined) {
    return { value: undefined, state: 'undefined-input' };
  }

  let result = tryParse(jsonText);
  if (result.success) {
    return { value: result.value, state: 'successful-parse' };
  }

  result = tryParse(fixJson(jsonText));
  if (result.success) {
    return { value: result.value, state: 'repaired-parse' };
  }

  return { value: undefined, state: 'failed-parse' };
}
