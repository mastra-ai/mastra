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

export interface McpOAuthFailure {
  message: string;
  /** The saved sign-in no longer works; only signing in again fixes it. */
  signInAgain: boolean;
}

const SIGN_IN_AGAIN = 'The authorization server no longer accepts this sign-in. Sign in again.';
const UNAVAILABLE = 'The authorization server failed or is busy. Try again later.';
const CLIENT_REJECTED = 'The authorization server does not accept this client. Check the client ID and secret.';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_grant: SIGN_IN_AGAIN,
  invalid_token: SIGN_IN_AGAIN,
  invalid_client: CLIENT_REJECTED,
  unauthorized_client: CLIENT_REJECTED,
  access_denied: 'The authorization server denied the sign-in.',
  invalid_scope: 'The authorization server rejected the requested scopes.',
  insufficient_scope: 'The sign-in does not grant the scopes this server needs.',
  invalid_redirect_uri: "The authorization server does not accept the Factory's redirect URI.",
  invalid_client_metadata: "The authorization server could not use the Factory's client metadata.",
  server_error: UNAVAILABLE,
  temporarily_unavailable: UNAVAILABLE,
  too_many_requests: UNAVAILABLE,
  invalid_request: 'The authorization server rejected the request (invalid_request).',
  unsupported_grant_type: 'The authorization server rejected the request (unsupported_grant_type).',
  unsupported_response_type: 'The authorization server rejected the request (unsupported_response_type).',
  unsupported_token_type: 'The authorization server rejected the request (unsupported_token_type).',
  method_not_allowed: 'The authorization server rejected the request (method_not_allowed).',
  invalid_target: 'The authorization server rejected the request (invalid_target).',
  invalid_dpop_proof: SIGN_IN_AGAIN,
  use_dpop_nonce: 'The authorization server rejected the request (use_dpop_nonce).',
};

/**
 * A fixed explanation for a standard OAuth error code, or `undefined` for
 * anything else. Authorization servers' own descriptions are never repeated:
 * the MCP SDK puts a whole unparseable response body in the message, and that
 * body can echo tokens or the client secret back.
 */
export function describeOAuthErrorCode(code: unknown): McpOAuthFailure | undefined {
  if (typeof code !== 'string' || !Object.hasOwn(OAUTH_ERROR_MESSAGES, code)) return undefined;
  return { message: OAUTH_ERROR_MESSAGES[code]!, signInAgain: OAUTH_ERROR_MESSAGES[code] === SIGN_IN_AGAIN };
}

/** The authorization server failure anywhere in an error's cause chain, explained without its own text. */
export function findOAuthFailure(error: unknown): McpOAuthFailure | undefined {
  for (let cause = error, depth = 0; cause && depth < 8; cause = (cause as { cause?: unknown }).cause, depth++) {
    if (cause instanceof Error && cause.name === 'OAuthError') {
      return (
        describeOAuthErrorCode((cause as { code?: unknown }).code) ?? {
          message: 'The authorization server returned an error.',
          signInAgain: false,
        }
      );
    }
  }
  return undefined;
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
