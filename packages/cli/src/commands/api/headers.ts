import { ApiCliError } from './errors.js';

export function parseHeaders(values: string[]): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const value of values) {
    const separatorIndex = value.indexOf(':');
    if (separatorIndex <= 0) {
      throw new ApiCliError('MALFORMED_HEADER', 'Header must use "Key: Value" format', { header: value });
    }

    const key = value.slice(0, separatorIndex).trim();
    const headerValue = value.slice(separatorIndex + 1).trim();

    if (!key || !headerValue) {
      throw new ApiCliError('MALFORMED_HEADER', 'Header must use "Key: Value" format', { header: value });
    }

    headers[key] = headerValue;
  }

  return headers;
}
