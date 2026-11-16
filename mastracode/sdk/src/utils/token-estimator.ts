import { estimateTokenCount, sliceByTokens } from 'tokenx';

// Unicode mode matches lone surrogate code points without matching complete pairs.
const UNPAIRED_SURROGATE_RE = /[\uD800-\uDFFF]/gu;

function sanitizeInput(text: string | object) {
  if (!text) return '';
  return (typeof text === `string` ? text : JSON.stringify(text))
    .replaceAll(`<|endoftext|>`, ``)
    .replaceAll(`<|endofprompt|>`, ``);
}

export function tokenEstimate(text: string | object): number {
  return estimateTokenCount(sanitizeInput(text));
}

export function truncateStringForTokenEstimate(text: string, desiredTokenCount: number, fromEnd = true) {
  const sanitized = sanitizeInput(text);
  const totalTokens = estimateTokenCount(sanitized);

  if (totalTokens <= desiredTokenCount) return sanitized;

  // tokenx cuts on UTF-16 code units, so a cut can split a surrogate pair (emoji, math letters).
  // The lone half makes the provider request invalid JSON, so replace it with U+FFFD.
  const kept = (
    fromEnd ? sliceByTokens(sanitized, -desiredTokenCount) : sliceByTokens(sanitized, 0, desiredTokenCount)
  ).replace(UNPAIRED_SURROGATE_RE, '�');

  return `[Truncated ~${totalTokens - desiredTokenCount} tokens]
${kept}`;
}
