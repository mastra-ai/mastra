import { Tiktoken } from 'js-tiktoken/lite';
import o200k_base from 'js-tiktoken/ranks/o200k_base';

const enc = new Tiktoken(o200k_base);

function sanitizeInput(text: string | object) {
  if (!text) return '';
  return (typeof text === `string` ? text : JSON.stringify(text))
    .replaceAll(`<|endoftext|>`, ``)
    .replaceAll(`<|endofprompt|>`, ``);
}
export function tokenEstimate(text: string | object): number {
  return enc.encode(sanitizeInput(text), `all`).length;
}

export function truncateStringForTokenEstimate(text: string, desiredTokenCount: number, fromEnd = true) {
  const tokens = enc.encode(sanitizeInput(text));

  if (tokens.length <= desiredTokenCount) return text;

  return `[Truncated ${tokens.length - desiredTokenCount} tokens]
${enc.decode(tokens.slice(fromEnd ? -desiredTokenCount : 0, fromEnd ? undefined : desiredTokenCount))}`;
}
