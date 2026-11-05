import type { McpServerRecord } from '../storage/domains/mcp-servers/base.js';

const MAX_ERROR_LENGTH = 300;

/**
 * Reduce an error message from an MCP server or authorization server to text
 * safe to store and show: its first meaningful line, with every secret saved
 * for the server removed, capped in length.
 */
export function safeErrorText(record: McpServerRecord, message: string): string {
  return scrubSecrets(record, firstLine(message));
}

function firstLine(message: string): string {
  const withoutPrefix = message.replace(/^Failed to connect to MCP server [^:]*:\s*/, '');
  const line = withoutPrefix.split('\n').find(part => part.trim() && !/^\s+at /.test(part)) ?? 'unknown error';
  return line.trim();
}

function scrubSecrets(record: McpServerRecord, text: string): string {
  const secrets = [...Object.values(record.headers ?? {}), record.oauthClientSecret]
    .filter((secret): secret is string => typeof secret === 'string' && secret.length > 0)
    // A bearer header's token can appear without its "Bearer " prefix.
    .flatMap(secret => [secret, secret.replace(/^\S+\s+/, '')])
    .filter(secret => secret.length >= 4)
    .sort((a, b) => b.length - a.length);
  let scrubbed = text;
  for (const secret of secrets) scrubbed = scrubbed.split(secret).join('[redacted]');
  return scrubbed.length > MAX_ERROR_LENGTH ? `${scrubbed.slice(0, MAX_ERROR_LENGTH - 1)}…` : scrubbed;
}
