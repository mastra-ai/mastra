/**
 * Auth error types and error class.
 *
 * Provides typed error handling for OAuth flow and session management.
 */

/**
 * Error codes for authentication-related failures.
 */
export type AuthErrorCode =
  | 'invalid_state'
  | 'state_mismatch'
  | 'missing_code'
  | 'token_exchange_failed'
  | 'verification_failed'
  | 'session_invalid'
  | 'session_expired'
  | 'network_error'
  | 'cloud_api_error';

/**
 * Options for AuthError constructor.
 */
export interface AuthErrorOptions {
  cause?: Error;
  cloudCode?: string;
  cloudMessage?: string;
}

/**
 * Error class for authentication-related failures.
 * Uses a code discriminator for programmatic error handling.
 */
export class AuthError extends Error {
  readonly code: AuthErrorCode;
  override readonly cause?: Error;
  readonly cloudCode?: string;
  readonly cloudMessage?: string;

  constructor(code: AuthErrorCode, message: string, options?: AuthErrorOptions) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.cause = options?.cause;
    this.cloudCode = options?.cloudCode;
    this.cloudMessage = options?.cloudMessage;
    // Required for instanceof checks in TypeScript
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Factory: OAuth state parameter is invalid or malformed.
   */
  static invalidState(): AuthError {
    return new AuthError('invalid_state', 'OAuth state parameter is invalid or malformed.');
  }

  /**
   * Factory: OAuth state parameter does not match expected value.
   */
  static stateMismatch(): AuthError {
    return new AuthError('state_mismatch', 'OAuth state parameter does not match. Possible CSRF attack.');
  }

  /**
   * Factory: Authorization code is missing from callback.
   */
  static missingCode(): AuthError {
    return new AuthError('missing_code', 'Authorization code is missing from OAuth callback.');
  }

  /**
   * Factory: Token exchange with Cloud API failed.
   */
  static tokenExchangeFailed(options?: AuthErrorOptions): AuthError {
    return new AuthError('token_exchange_failed', 'Failed to exchange authorization code for tokens.', options);
  }

  /**
   * Factory: Token verification failed.
   */
  static verificationFailed(): AuthError {
    return new AuthError('verification_failed', 'Token verification failed.');
  }

  /**
   * Factory: Session is invalid.
   */
  static sessionInvalid(): AuthError {
    return new AuthError('session_invalid', 'Session is invalid or has been revoked.');
  }

  /**
   * Factory: Session has expired.
   */
  static sessionExpired(): AuthError {
    return new AuthError('session_expired', 'Session has expired. Please log in again.');
  }

  /**
   * Factory: Network error during API call.
   */
  static networkError(cause?: Error): AuthError {
    return new AuthError('network_error', 'Network error occurred while communicating with Cloud API.', { cause });
  }

  /**
   * Factory: Cloud API returned an error.
   */
  static cloudApiError(options?: AuthErrorOptions): AuthError {
    const message = options?.cloudMessage ?? 'Cloud API returned an error.';
    return new AuthError('cloud_api_error', message, options);
  }
}
