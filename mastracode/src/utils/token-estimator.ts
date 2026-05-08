import { estimateTokenCount, sliceByTokens } from 'tokenx';

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

  const kept = fromEnd ? sliceByTokens(sanitized, -desiredTokenCount) : sliceByTokens(sanitized, 0, desiredTokenCount);

  return `[Truncated ~${totalTokens - desiredTokenCount} tokens]
${kept}`;
}
