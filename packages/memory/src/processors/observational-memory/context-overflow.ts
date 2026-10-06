/**
 * Detects provider errors that reject a request for exceeding the model's context window.
 *
 * Providers report this with different codes and wording, so this matches the known shapes
 * (OpenAI and OpenAI-compatible APIs, Anthropic, Google, Bedrock, xAI, Mistral, local servers)
 * against the error's message, code, response body and causes.
 */
const CONTEXT_OVERFLOW_PATTERNS = [
  /context[_ ]length[_ ]exceeded/i,
  /maximum context length/i,
  /maximum prompt length/i,
  /prompt is too long/i,
  /input is too long/i,
  /exceed\w*\b[^.]{0,40}\bcontext (?:window|length|limit|size)/i,
  /input token count[^.]{0,40}exceeds the maximum/i,
  /reduce the length of the (?:messages|prompt|input)/i,
];

const MAX_CAUSE_DEPTH = 4;

function collectErrorText(error: unknown, depth = 0): string[] {
  if (depth > MAX_CAUSE_DEPTH || error == null) return [];
  if (typeof error === 'string') return [error];
  if (typeof error !== 'object') return [];

  const record = error as Record<string, unknown>;
  const texts: string[] = [];
  for (const key of ['message', 'code', 'type', 'responseBody']) {
    const value = record[key];
    if (typeof value === 'string') texts.push(value);
  }
  if (record.data && typeof record.data === 'object') {
    texts.push(...collectErrorText((record.data as Record<string, unknown>).error ?? record.data, depth + 1));
  }
  if (record.error && typeof record.error === 'object') {
    texts.push(...collectErrorText(record.error, depth + 1));
  }
  texts.push(...collectErrorText(record.cause, depth + 1));
  return texts;
}

export function isContextOverflowError(error: unknown): boolean {
  // Token-per-minute rate limits mention tokens and request size too, but retrying them
  // after observing would not help.
  if (error && typeof error === 'object' && (error as Record<string, unknown>).statusCode === 429) {
    return false;
  }
  return collectErrorText(error).some(text => CONTEXT_OVERFLOW_PATTERNS.some(pattern => pattern.test(text)));
}
