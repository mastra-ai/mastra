import type * as Tokenx from 'tokenx';

let tokenxPromise: Promise<typeof Tokenx> | undefined;

function loadTokenx(): Promise<typeof Tokenx> {
  return (tokenxPromise ??= import('tokenx'));
}

function sanitizeInput(text: string | object) {
  if (!text) return '';
  return (typeof text === `string` ? text : JSON.stringify(text))
    .replaceAll(`<|endoftext|>`, ``)
    .replaceAll(`<|endofprompt|>`, ``);
}

export async function tokenEstimate(text: string | object): Promise<number> {
  const { estimateTokenCount } = await loadTokenx();
  return estimateTokenCount(sanitizeInput(text));
}

export async function truncateStringForTokenEstimate(text: string, desiredTokenCount: number, fromEnd = true) {
  const { estimateTokenCount, sliceByTokens } = await loadTokenx();
  const sanitized = sanitizeInput(text);
  const totalTokens = estimateTokenCount(sanitized);

  if (totalTokens <= desiredTokenCount) return sanitized;

  const kept = fromEnd ? sliceByTokens(sanitized, -desiredTokenCount) : sliceByTokens(sanitized, 0, desiredTokenCount);

  return `[Truncated ~${totalTokens - desiredTokenCount} tokens]
${kept}`;
}
