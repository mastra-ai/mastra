import type { InputLimits } from '../contracts/limits.ts';
import { ParseFault } from './contract.ts';

export const decoder = new TextDecoder('utf-8', { fatal: true });
export function decodeText(bytes: Uint8Array, limits: InputLimits): string {
  const text = decoder.decode(bytes);
  if (text.length > limits.maxTextChars) throw new ParseFault('LIMIT_EXCEEDED');
  return text;
}
