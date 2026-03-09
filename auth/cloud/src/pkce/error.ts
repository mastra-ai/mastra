/**
 * PKCE error types and error class.
 *
 * @internal This module is not exported from the main package.
 */

/**
 * Error codes for PKCE-related failures.
 */
export type PKCEErrorCode = 'MISSING_VERIFIER' | 'EXPIRED' | 'INVALID';

/**
 * Error class for PKCE-related failures.
 * Uses a code discriminator for programmatic error handling.
 */
export class PKCEError extends Error {
  readonly code: PKCEErrorCode;
  override readonly cause?: Error;

  constructor(code: PKCEErrorCode, message: string, cause?: Error) {
    super(message);
    this.name = 'PKCEError';
    this.code = code;
    this.cause = cause;
    // Required for instanceof checks in TypeScript
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Factory: PKCE verifier cookie not found.
   */
  static missingVerifier(): PKCEError {
    return new PKCEError(
      'MISSING_VERIFIER',
      'PKCE verifier cookie not found. Authorization flow may have expired or was not initiated properly.',
    );
  }

  /**
   * Factory: PKCE verifier has expired.
   */
  static expired(): PKCEError {
    return new PKCEError('EXPIRED', 'PKCE verifier has expired. Please restart the authorization flow.');
  }

  /**
   * Factory: PKCE verifier cookie is malformed.
   */
  static invalid(cause?: Error): PKCEError {
    return new PKCEError('INVALID', 'PKCE verifier cookie is malformed or invalid.', cause);
  }
}
