import { parsePartialJson } from '../utils/ai-sdk-v4/parse-partial-json';
import type { JSONValue } from './types';

/** @experimental Generative UI is in beta and may change without notice. */
export interface PartialJSONResult {
  /** Best-effort value. `undefined` when nothing usable has arrived yet. */
  value: JSONValue | undefined;
  /** True when the text is a complete, valid JSON document. */
  complete: boolean;
}

/**
 * Tolerant JSON parser for streamed tool arguments (the AI SDK's partial-JSON repair).
 * Run the value through `toSafeJSONValue` before trusting it.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function parsePartialJSON(text: string): PartialJSONResult {
  const { value, state } = parsePartialJson(text);
  return { value: value as JSONValue | undefined, complete: state === 'successful-parse' };
}
