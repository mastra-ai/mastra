import GoTrueClient from '../GoTrueClient';
import { AuthError } from './errors';
import { AuthMFAEnrollWebauthnResponse, AuthMFAVerifyResponse, AuthMFAVerifyResponseData, MFAChallengeWebauthnParams, MFAEnrollWebauthnParams, MFAVerifyWebauthnParamFields, MFAVerifyWebauthnParams, RequestResult, StrictOmit } from './types';
import type { AuthenticationCredential, AuthenticationResponseJSON, PublicKeyCredentialCreationOptionsFuture, PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsFuture, PublicKeyCredentialRequestOptionsJSON, RegistrationCredential, RegistrationResponseJSON } from './webauthn.dom';
import { identifyAuthenticationError, identifyRegistrationError, isWebAuthnError, WebAuthnError } from './webauthn.errors';
export { WebAuthnError, isWebAuthnError, identifyRegistrationError, identifyAuthenticationError };
export type { RegistrationResponseJSON, AuthenticationResponseJSON };
/**
 * WebAuthn abort service to manage ceremony cancellation.
 * Ensures only one WebAuthn ceremony is active at a time to prevent "operation already in progress" errors.
 *
 * @experimental This class is experimental and may change in future releases
 * @see {@link https://w3c.github.io/webauthn/#sctn-automation-webdriver-capability W3C WebAuthn Spec - Aborting Ceremonies}
 */
export declare class WebAuthnAbortService {
    private controller;
    /**
     * Create an abort signal for a new WebAuthn operation.
     * Automatically cancels any existing operation.
     *
     * @returns {AbortSignal} Signal to pass to navigator.credentials.create() or .get()
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal MDN - AbortSignal}
     */
    createNewAbortSignal(): AbortSignal;
    /**
     * Manually cancel the current WebAuthn operation.
     * Useful for cleaning up when user cancels or navigates away.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort MDN - AbortController.abort}
     */
    cancelCeremony(): void;
}
/**
 * Singleton instance to ensure only one WebAuthn ceremony is active at a time.
 * This prevents "operation already in progress" errors when retrying WebAuthn operations.
 *
 * @experimental This instance is experimental and may change in future releases
 */
export declare const webAuthnAbortService: WebAuthnAbortService;
/**
 * Server response format for WebAuthn credential creation options.
 * Uses W3C standard JSON format with base64url-encoded binary fields.
 */
export type ServerCredentialCreationOptions = PublicKeyCredentialCreationOptionsJSON;
/**
 * Server response format for WebAuthn credential request options.
 * Uses W3C standard JSON format with base64url-encoded binary fields.
 */
export type ServerCredentialRequestOptions = PublicKeyCredentialRequestOptionsJSON;
/**
 * Convert base64url encoded strings in WebAuthn credential creation options to ArrayBuffers
 * as required by the WebAuthn browser API.
 * Supports both native WebAuthn Level 3 parseCreationOptionsFromJSON and manual fallback.
 *
 * @param {ServerCredentialCreationOptions} options - JSON options from server with base64url encoded fields
 * @returns {PublicKeyCredentialCreationOptionsFuture} Options ready for navigator.credentials.create()
 * @see {@link https://w3c.github.io/webauthn/#sctn-parseCreationOptionsFromJSON W3C WebAuthn Spec - parseCreationOptionsFromJSON}
 */
export declare function deserializeCredentialCreationOptions(options: ServerCredentialCreationOptions): PublicKeyCredentialCreationOptionsFuture;
/**
 * Convert base64url encoded strings in WebAuthn credential request options to ArrayBuffers
 * as required by the WebAuthn browser API.
 * Supports both native WebAuthn Level 3 parseRequestOptionsFromJSON and manual fallback.
 *
 * @param {ServerCredentialRequestOptions} options - JSON options from server with base64url encoded fields
 * @returns {PublicKeyCredentialRequestOptionsFuture} Options ready for navigator.credentials.get()
 * @see {@link https://w3c.github.io/webauthn/#sctn-parseRequestOptionsFromJSON W3C WebAuthn Spec - parseRequestOptionsFromJSON}
 */
export declare function deserializeCredentialRequestOptions(options: ServerCredentialRequestOptions): PublicKeyCredentialRequestOptionsFuture;
/**
 * Server format for credential response with base64url-encoded binary fields
 * Can be either a registration or authentication response
 */
export type ServerCredentialResponse = RegistrationResponseJSON | AuthenticationResponseJSON;
/**
 * Convert a registration/enrollment credential response to server format.
 * Serializes binary fields to base64url for JSON transmission.
 * Supports both native WebAuthn Level 3 toJSON and manual fallback.
 *
 * @param {RegistrationCredential} credential - Credential from navigator.credentials.create()
 * @returns {RegistrationResponseJSON} JSON-serializable credential for server
 * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredential-tojson W3C WebAuthn Spec - toJSON}
 */
export declare function serializeCredentialCreationResponse(credential: RegistrationCredential): RegistrationResponseJSON;
/**
 * Convert an authentication/verification credential response to server format.
 * Serializes binary fields to base64url for JSON transmission.
 * Supports both native WebAuthn Level 3 toJSON and manual fallback.
 *
 * @param {AuthenticationCredential} credential - Credential from navigator.credentials.get()
 * @returns {AuthenticationResponseJSON} JSON-serializable credential for server
 * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredential-tojson W3C WebAuthn Spec - toJSON}
 */
export declare function serializeCredentialRequestResponse(credential: AuthenticationCredential): AuthenticationResponseJSON;
/**
 * A simple test to determine if a hostname is a properly-formatted domain name.
 * Considers localhost valid for development environments.
 *
 * A "valid domain" is defined here: https://url.spec.whatwg.org/#valid-domain
 *
 * Regex sourced from here:
 * https://www.oreilly.com/library/view/regular-expressions-cookbook/9781449327453/ch08s15.html
 *
 * @param {string} hostname - The hostname to validate
 * @returns {boolean} True if valid domain or localhost
 * @see {@link https://url.spec.whatwg.org/#valid-domain WHATWG URL Spec - Valid Domain}
 */
export declare function isValidDomain(hostname: string): boolean;
/**
 * Create a WebAuthn credential using the browser's credentials API.
 * Wraps navigator.credentials.create() with error handling.
 *
 * @param {CredentialCreationOptions} options - Options including publicKey parameters
 * @returns {Promise<RequestResult<RegistrationCredential, WebAuthnError>>} Created credential or error
 * @see {@link https://w3c.github.io/webauthn/#sctn-createCredential W3C WebAuthn Spec - Create Credential}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/CredentialsContainer/create MDN - credentials.create}
 */
export declare function createCredential(options: StrictOmit<CredentialCreationOptions, 'publicKey'> & {
    publicKey: PublicKeyCredentialCreationOptionsFuture;
}): Promise<RequestResult<RegistrationCredential, WebAuthnError>>;
/**
 * Get a WebAuthn credential using the browser's credentials API.
 * Wraps navigator.credentials.get() with error handling.
 *
 * @param {CredentialRequestOptions} options - Options including publicKey parameters
 * @returns {Promise<RequestResult<AuthenticationCredential, WebAuthnError>>} Retrieved credential or error
 * @see {@link https://w3c.github.io/webauthn/#sctn-getAssertion W3C WebAuthn Spec - Get Assertion}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/CredentialsContainer/get MDN - credentials.get}
 */
export declare function getCredential(options: StrictOmit<CredentialRequestOptions, 'publicKey'> & {
    publicKey: PublicKeyCredentialRequestOptionsFuture;
}): Promise<RequestResult<AuthenticationCredential, WebAuthnError>>;
export declare const DEFAULT_CREATION_OPTIONS: Partial<PublicKeyCredentialCreationOptionsFuture>;
export declare const DEFAULT_REQUEST_OPTIONS: Partial<PublicKeyCredentialRequestOptionsFuture>;
/**
 * Merges WebAuthn credential creation options with overrides.
 * Sets sensible defaults for authenticator selection and extensions.
 *
 * @param {PublicKeyCredentialCreationOptionsFuture} baseOptions - The base options from the server
 * @param {PublicKeyCredentialCreationOptionsFuture} overrides - Optional overrides to apply
 * @param {string} friendlyName - Optional friendly name for the credential
 * @returns {PublicKeyCredentialCreationOptionsFuture} Merged credential creation options
 * @see {@link https://w3c.github.io/webauthn/#dictdef-authenticatorselectioncriteria W3C WebAuthn Spec - AuthenticatorSelectionCriteria}
 */
export declare function mergeCredentialCreationOptions(baseOptions: PublicKeyCredentialCreationOptionsFuture, overrides?: Partial<PublicKeyCredentialCreationOptionsFuture>): PublicKeyCredentialCreationOptionsFuture;
/**
 * Merges WebAuthn credential request options with overrides.
 * Sets sensible defaults for user verification and hints.
 *
 * @param {PublicKeyCredentialRequestOptionsFuture} baseOptions - The base options from the server
 * @param {PublicKeyCredentialRequestOptionsFuture} overrides - Optional overrides to apply
 * @returns {PublicKeyCredentialRequestOptionsFuture} Merged credential request options
 * @see {@link https://w3c.github.io/webauthn/#dictdef-publickeycredentialrequestoptions W3C WebAuthn Spec - PublicKeyCredentialRequestOptions}
 */
export declare function mergeCredentialRequestOptions(baseOptions: PublicKeyCredentialRequestOptionsFuture, overrides?: Partial<PublicKeyCredentialRequestOptionsFuture>): PublicKeyCredentialRequestOptionsFuture;
/**
 * WebAuthn API wrapper for Supabase Auth.
 * Provides methods for enrolling, challenging, verifying, authenticating, and registering WebAuthn credentials.
 *
 * @experimental This API is experimental and may change in future releases
 * @see {@link https://w3c.github.io/webauthn/ W3C WebAuthn Specification}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API MDN - Web Authentication API}
 */
export declare class WebAuthnApi {
    private client;
    enroll: typeof WebAuthnApi.prototype._enroll;
    challenge: typeof WebAuthnApi.prototype._challenge;
    verify: typeof WebAuthnApi.prototype._verify;
    authenticate: typeof WebAuthnApi.prototype._authenticate;
    register: typeof WebAuthnApi.prototype._register;
    constructor(client: GoTrueClient);
    /**
     * Enroll a new WebAuthn factor.
     * Creates an unverified WebAuthn factor that must be verified with a credential.
     *
     * @experimental This method is experimental and may change in future releases
     * @param {Omit<MFAEnrollWebauthnParams, 'factorType'>} params - Enrollment parameters (friendlyName required)
     * @returns {Promise<AuthMFAEnrollWebauthnResponse>} Enrolled factor details or error
     * @see {@link https://w3c.github.io/webauthn/#sctn-registering-a-new-credential W3C WebAuthn Spec - Registering a New Credential}
     */
    _enroll(params: Omit<MFAEnrollWebauthnParams, 'factorType'>): Promise<AuthMFAEnrollWebauthnResponse>;
    /**
     * Challenge for WebAuthn credential creation or authentication.
     * Combines server challenge with browser credential operations.
     * Handles both registration (create) and authentication (request) flows.
     *
     * @experimental This method is experimental and may change in future releases
     * @param {MFAChallengeWebauthnParams & { friendlyName?: string; signal?: AbortSignal }} params - Challenge parameters including factorId
     * @param {Object} overrides - Allows you to override the parameters passed to navigator.credentials
     * @param {PublicKeyCredentialCreationOptionsFuture} overrides.create - Override options for credential creation
     * @param {PublicKeyCredentialRequestOptionsFuture} overrides.request - Override options for credential request
     * @returns {Promise<RequestResult>} Challenge response with credential or error
     * @see {@link https://w3c.github.io/webauthn/#sctn-credential-creation W3C WebAuthn Spec - Credential Creation}
     * @see {@link https://w3c.github.io/webauthn/#sctn-verifying-assertion W3C WebAuthn Spec - Verifying Assertion}
     */
    _challenge({ factorId, webauthn, friendlyName, signal, }: MFAChallengeWebauthnParams & {
        friendlyName?: string;
        signal?: AbortSignal;
    }, overrides?: {
        create?: Partial<PublicKeyCredentialCreationOptionsFuture>;
        request?: never;
    } | {
        create?: never;
        request?: Partial<PublicKeyCredentialRequestOptionsFuture>;
    }): Promise<RequestResult<{
        factorId: string;
        challengeId: string;
    } & {
        webauthn: StrictOmit<MFAVerifyWebauthnParamFields<'create' | 'request'>['webauthn'], 'rpId' | 'rpOrigins'>;
    }, WebAuthnError | AuthError>>;
    /**
     * Verify a WebAuthn credential with the server.
     * Completes the WebAuthn ceremony by sending the credential to the server for verification.
     *
     * @experimental This method is experimental and may change in future releases
     * @param {Object} params - Verification parameters
     * @param {string} params.challengeId - ID of the challenge being verified
     * @param {string} params.factorId - ID of the WebAuthn factor
     * @param {MFAVerifyWebauthnParams<T>['webauthn']} params.webauthn - WebAuthn credential response
     * @returns {Promise<AuthMFAVerifyResponse>} Verification result with session or error
     * @see {@link https://w3c.github.io/webauthn/#sctn-verifying-assertion W3C WebAuthn Spec - Verifying an Authentication Assertion}
     * */
    _verify<T extends 'create' | 'request'>({ challengeId, factorId, webauthn, }: {
        challengeId: string;
        factorId: string;
        webauthn: MFAVerifyWebauthnParams<T>['webauthn'];
    }): Promise<AuthMFAVerifyResponse>;
    /**
     * Complete WebAuthn authentication flow.
     * Performs challenge and verification in a single operation for existing credentials.
     *
     * @experimental This method is experimental and may change in future releases
     * @param {Object} params - Authentication parameters
     * @param {string} params.factorId - ID of the WebAuthn factor to authenticate with
     * @param {Object} params.webauthn - WebAuthn configuration
     * @param {string} params.webauthn.rpId - Relying Party ID (defaults to current hostname)
     * @param {string[]} params.webauthn.rpOrigins - Allowed origins (defaults to current origin)
     * @param {AbortSignal} params.webauthn.signal - Optional abort signal
     * @param {PublicKeyCredentialRequestOptionsFuture} overrides - Override options for navigator.credentials.get
     * @returns {Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>>} Authentication result
     * @see {@link https://w3c.github.io/webauthn/#sctn-authentication W3C WebAuthn Spec - Authentication Ceremony}
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialRequestOptions MDN - PublicKeyCredentialRequestOptions}
     */
    _authenticate({ factorId, webauthn: { rpId, rpOrigins, signal, }, }: {
        factorId: string;
        webauthn: {
            rpId?: string;
            rpOrigins?: string[];
            signal?: AbortSignal;
        };
    }, overrides?: PublicKeyCredentialRequestOptionsFuture): Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>>;
    /**
     * Complete WebAuthn registration flow.
     * Performs enrollment, challenge, and verification in a single operation for new credentials.
     *
     * @experimental This method is experimental and may change in future releases
     * @param {Object} params - Registration parameters
     * @param {string} params.friendlyName - User-friendly name for the credential
     * @param {string} params.rpId - Relying Party ID (defaults to current hostname)
     * @param {string[]} params.rpOrigins - Allowed origins (defaults to current origin)
     * @param {AbortSignal} params.signal - Optional abort signal
     * @param {PublicKeyCredentialCreationOptionsFuture} overrides - Override options for navigator.credentials.create
     * @returns {Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>>} Registration result
     * @see {@link https://w3c.github.io/webauthn/#sctn-registering-a-new-credential W3C WebAuthn Spec - Registration Ceremony}
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialCreationOptions MDN - PublicKeyCredentialCreationOptions}
     */
    _register({ friendlyName, rpId, rpOrigins, signal, }: {
        friendlyName: string;
        rpId?: string;
        rpOrigins?: string[];
        signal?: AbortSignal;
    }, overrides?: Partial<PublicKeyCredentialCreationOptionsFuture>): Promise<RequestResult<AuthMFAVerifyResponseData, WebAuthnError | AuthError>>;
}
//# sourceMappingURL=webauthn.d.ts.map