import { StrictOmit } from './types';
import { PublicKeyCredentialCreationOptionsFuture, PublicKeyCredentialRequestOptionsFuture } from './webauthn.dom';
/**
 * A custom Error used to return a more nuanced error detailing _why_ one of the eight documented
 * errors in the spec was raised after calling `navigator.credentials.create()` or
 * `navigator.credentials.get()`:
 *
 * - `AbortError`
 * - `ConstraintError`
 * - `InvalidStateError`
 * - `NotAllowedError`
 * - `NotSupportedError`
 * - `SecurityError`
 * - `TypeError`
 * - `UnknownError`
 *
 * Error messages were determined through investigation of the spec to determine under which
 * scenarios a given error would be raised.
 */
export declare class WebAuthnError extends Error {
    code: WebAuthnErrorCode;
    protected __isWebAuthnError: boolean;
    constructor({ message, code, cause, name, }: {
        message: string;
        code: WebAuthnErrorCode;
        cause?: Error | unknown;
        name?: string;
    });
}
/**
 * Error class for unknown WebAuthn errors.
 * Wraps unexpected errors that don't match known WebAuthn error conditions.
 */
export declare class WebAuthnUnknownError extends WebAuthnError {
    originalError: unknown;
    constructor(message: string, originalError: unknown);
}
/**
 * Type guard to check if an error is a WebAuthnError.
 * @param {unknown} error - The error to check
 * @returns {boolean} True if the error is a WebAuthnError
 */
export declare function isWebAuthnError(error: unknown): error is WebAuthnError;
/**
 * Error codes for WebAuthn operations.
 * These codes provide specific information about why a WebAuthn ceremony failed.
 * @see {@link https://w3c.github.io/webauthn/#sctn-defined-errors W3C WebAuthn Spec - Defined Errors}
 */
export type WebAuthnErrorCode = 'ERROR_CEREMONY_ABORTED' | 'ERROR_INVALID_DOMAIN' | 'ERROR_INVALID_RP_ID' | 'ERROR_INVALID_USER_ID_LENGTH' | 'ERROR_MALFORMED_PUBKEYCREDPARAMS' | 'ERROR_AUTHENTICATOR_GENERAL_ERROR' | 'ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT' | 'ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT' | 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' | 'ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG' | 'ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE' | 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY';
/**
 * Attempt to intuit _why_ an error was raised after calling `navigator.credentials.create()`.
 * Maps browser errors to specific WebAuthn error codes for better debugging.
 * @param {Object} params - Error identification parameters
 * @param {Error} params.error - The error thrown by the browser
 * @param {CredentialCreationOptions} params.options - The options passed to credentials.create()
 * @returns {WebAuthnError} A WebAuthnError with a specific error code
 * @see {@link https://w3c.github.io/webauthn/#sctn-createCredential W3C WebAuthn Spec - Create Credential}
 */
export declare function identifyRegistrationError({ error, options, }: {
    error: Error;
    options: StrictOmit<CredentialCreationOptions, 'publicKey'> & {
        publicKey: PublicKeyCredentialCreationOptionsFuture;
    };
}): WebAuthnError;
/**
 * Attempt to intuit _why_ an error was raised after calling `navigator.credentials.get()`.
 * Maps browser errors to specific WebAuthn error codes for better debugging.
 * @param {Object} params - Error identification parameters
 * @param {Error} params.error - The error thrown by the browser
 * @param {CredentialRequestOptions} params.options - The options passed to credentials.get()
 * @returns {WebAuthnError} A WebAuthnError with a specific error code
 * @see {@link https://w3c.github.io/webauthn/#sctn-getAssertion W3C WebAuthn Spec - Get Assertion}
 */
export declare function identifyAuthenticationError({ error, options, }: {
    error: Error;
    options: StrictOmit<CredentialRequestOptions, 'publicKey'> & {
        publicKey: PublicKeyCredentialRequestOptionsFuture;
    };
}): WebAuthnError;
//# sourceMappingURL=webauthn.errors.d.ts.map