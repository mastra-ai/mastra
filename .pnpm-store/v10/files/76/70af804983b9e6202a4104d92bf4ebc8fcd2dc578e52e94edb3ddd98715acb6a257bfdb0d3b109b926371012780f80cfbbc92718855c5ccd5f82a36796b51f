// from https://github.com/MasterKale/SimpleWebAuthn/blob/master/packages/browser/src/types/index.ts

import { StrictOmit } from './types'

/**
 * A variant of PublicKeyCredentialCreationOptions suitable for JSON transmission to the browser to
 * (eventually) get passed into navigator.credentials.create(...) in the browser.
 *
 * This should eventually get replaced with official TypeScript DOM types when WebAuthn Level 3 types
 * eventually make it into the language:
 *
 * @see {@link https://w3c.github.io/webauthn/#dictdef-publickeycredentialcreationoptionsjson W3C WebAuthn Spec - PublicKeyCredentialCreationOptionsJSON}
 */
export interface PublicKeyCredentialCreationOptionsJSON {
  /**
   * Information about the Relying Party responsible for the request.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialcreationoptions-rp W3C - rp}
   */
  rp: PublicKeyCredentialRpEntity
  /**
   * Information about the user account for which the credential is being created.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialcreationoptions-user W3C - user}
   */
  user: PublicKeyCredentialUserEntityJSON
  /**
   * A server-generated challenge in base64url format.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialcreationoptions-challenge W3C - challenge}
   */
  challenge: Base64URLString
  /**
   * Information about desired properties of the credential to be created.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialcreationoptions-pubkeycredparams W3C - pubKeyCredParams}
   */
  pubKeyCredParams: PublicKeyCredentialParameters[]
  /**
   * Time in milliseconds that the caller is willing to wait for the operation to complete.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialcreationoptions-timeout W3C - timeout}
   */
  timeout?: number
  /**
   * Credentials that the authenticator should not create a new credential for.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialcreationoptions-excludecredentials W3C - excludeCredentials}
   */
  excludeCredentials?: PublicKeyCredentialDescriptorJSON[]
  /**
   * Criteria for authenticator selection.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialcreationoptions-authenticatorselection W3C - authenticatorSelection}
   */
  authenticatorSelection?: AuthenticatorSelectionCriteria
  /**
   * Hints about what types of authenticators the user might want to use.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialcreationoptions-hints W3C - hints}
   */
  hints?: PublicKeyCredentialHint[]
  /**
   * How the attestation statement should be transported.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialcreationoptions-attestation W3C - attestation}
   */
  attestation?: AttestationConveyancePreference
  /**
   * The attestation statement formats that the Relying Party will accept.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialcreationoptions-attestationformats W3C - attestationFormats}
   */
  attestationFormats?: AttestationFormat[]
  /**
   * Additional parameters requesting additional processing by the client and authenticator.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialcreationoptions-extensions W3C - extensions}
   */
  extensions?: AuthenticationExtensionsClientInputs
}

/**
 * A variant of PublicKeyCredentialRequestOptions suitable for JSON transmission to the browser to
 * (eventually) get passed into navigator.credentials.get(...) in the browser.
 *
 * @see {@link https://w3c.github.io/webauthn/#dictdef-publickeycredentialrequestoptionsjson W3C WebAuthn Spec - PublicKeyCredentialRequestOptionsJSON}
 */
export interface PublicKeyCredentialRequestOptionsJSON {
  /**
   * A server-generated challenge in base64url format.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialrequestoptions-challenge W3C - challenge}
   */
  challenge: Base64URLString
  /**
   * Time in milliseconds that the caller is willing to wait for the operation to complete.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialrequestoptions-timeout W3C - timeout}
   */
  timeout?: number
  /**
   * The relying party identifier claimed by the caller.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialrequestoptions-rpid W3C - rpId}
   */
  rpId?: string
  /**
   * A list of credentials acceptable for authentication.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialrequestoptions-allowcredentials W3C - allowCredentials}
   */
  allowCredentials?: PublicKeyCredentialDescriptorJSON[]
  /**
   * Whether user verification should be performed by the authenticator.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialrequestoptions-userverification W3C - userVerification}
   */
  userVerification?: UserVerificationRequirement
  /**
   * Hints about what types of authenticators the user might want to use.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialrequestoptions-hints W3C - hints}
   */
  hints?: PublicKeyCredentialHint[]
  /**
   * Additional parameters requesting additional processing by the client and authenticator.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialrequestoptions-extensions W3C - extensions}
   */
  extensions?: AuthenticationExtensionsClientInputs
}

/**
 * Represents a public key credential descriptor in JSON format.
 * Used to identify credentials for exclusion or allowance during WebAuthn ceremonies.
 *
 * @see {@link https://w3c.github.io/webauthn/#dictdef-publickeycredentialdescriptorjson W3C WebAuthn Spec - PublicKeyCredentialDescriptorJSON}
 */
export interface PublicKeyCredentialDescriptorJSON {
  /**
   * The credential ID in base64url format.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialdescriptor-id W3C - id}
   */
  id: Base64URLString
  /**
   * The type of the public key credential (always "public-key").
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialdescriptor-type W3C - type}
   */
  type: PublicKeyCredentialType
  /**
   * How the authenticator communicates with clients.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialdescriptor-transports W3C - transports}
   */
  transports?: AuthenticatorTransportFuture[]
}

/**
 * Represents user account information in JSON format for WebAuthn registration.
 * Contains identifiers and display information for the user being registered.
 *
 * @see {@link https://w3c.github.io/webauthn/#dictdef-publickeycredentialuserentityjson W3C WebAuthn Spec - PublicKeyCredentialUserEntityJSON}
 */
export interface PublicKeyCredentialUserEntityJSON {
  /**
   * A unique identifier for the user account (base64url encoded).
   * Maximum 64 bytes. Should not contain PII.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialuserentity-id W3C - user.id}
   */
  id: string
  /**
   * A human-readable identifier for the account (e.g., email, username).
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialentity-name W3C - user.name}
   */
  name: string
  /**
   * A human-friendly display name for the user (e.g., "John Doe").
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialuserentity-displayname W3C - user.displayName}
   */
  displayName: string
}

/**
 * Represents user account information for WebAuthn registration with binary data.
 * Contains identifiers and display information for the user being registered.
 *
 * @see {@link https://w3c.github.io/webauthn/#dictdef-publickeycredentialuserentity W3C WebAuthn Spec - PublicKeyCredentialUserEntity}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialUserEntity MDN - PublicKeyCredentialUserEntity}
 */
export interface PublicKeyCredentialUserEntity {
  /**
   * A unique identifier for the user account.
   * Maximum 64 bytes. Should not contain PII.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialuserentity-id W3C - user.id}
   */
  id: BufferSource // ArrayBuffer | TypedArray | DataView

  /**
   * A human-readable identifier for the account.
   * Typically an email, username, or phone number.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialentity-name W3C - user.name}
   */
  name: string

  /**
   * A human-friendly display name for the user.
   * Example: "John Doe"
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialuserentity-displayname W3C - user.displayName}
   */
  displayName: string
}

/**
 * The credential returned from navigator.credentials.create() during WebAuthn registration.
 * Contains the new credential's public key and attestation information.
 *
 * @see {@link https://w3c.github.io/webauthn/#registrationceremony W3C WebAuthn Spec - Registration}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredential MDN - PublicKeyCredential}
 */
export interface RegistrationCredential
  extends PublicKeyCredentialFuture<RegistrationResponseJSON> {
  response: AuthenticatorAttestationResponseFuture
}

/**
 * A slightly-modified RegistrationCredential to simplify working with ArrayBuffers that
 * are Base64URL-encoded in the browser so that they can be sent as JSON to the server.
 *
 * @see {@link https://w3c.github.io/webauthn/#dictdef-registrationresponsejson W3C WebAuthn Spec - RegistrationResponseJSON}
 */
export interface RegistrationResponseJSON {
  /**
   * The credential ID (same as rawId for JSON).
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredential-id W3C - id}
   */
  id: Base64URLString
  /**
   * The raw credential ID in base64url format.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredential-rawid W3C - rawId}
   */
  rawId: Base64URLString
  /**
   * The authenticator's response to the client's request to create a credential.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredential-response W3C - response}
   */
  response: AuthenticatorAttestationResponseJSON
  /**
   * The authenticator attachment modality in effect at the time of credential creation.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredential-authenticatorattachment W3C - authenticatorAttachment}
   */
  authenticatorAttachment?: AuthenticatorAttachment
  /**
   * The results of processing client extensions.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredential-getclientextensionresults W3C - getClientExtensionResults}
   */
  clientExtensionResults: AuthenticationExtensionsClientOutputs
  /**
   * The type of the credential (always "public-key").
   * @see {@link https://w3c.github.io/webauthn/#dom-credential-type W3C - type}
   */
  type: PublicKeyCredentialType
}

/**
 * The credential returned from navigator.credentials.get() during WebAuthn authentication.
 * Contains the assertion signature proving possession of the private key.
 *
 * @see {@link https://w3c.github.io/webauthn/#authentication W3C WebAuthn Spec - Authentication}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredential MDN - PublicKeyCredential}
 */
export interface AuthenticationCredential
  extends PublicKeyCredentialFuture<AuthenticationResponseJSON> {
  response: AuthenticatorAssertionResponse
}

/**
 * A slightly-modified AuthenticationCredential to simplify working with ArrayBuffers that
 * are Base64URL-encoded in the browser so that they can be sent as JSON to the server.
 *
 * @see {@link https://w3c.github.io/webauthn/#dictdef-authenticationresponsejson W3C WebAuthn Spec - AuthenticationResponseJSON}
 */
export interface AuthenticationResponseJSON {
  /**
   * The credential ID (same as rawId for JSON).
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredential-id W3C - id}
   */
  id: Base64URLString
  /**
   * The raw credential ID in base64url format.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredential-rawid W3C - rawId}
   */
  rawId: Base64URLString
  /**
   * The authenticator's response to the client's request to authenticate.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredential-response W3C - response}
   */
  response: AuthenticatorAssertionResponseJSON
  /**
   * The authenticator attachment modality in effect at the time of authentication.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredential-authenticatorattachment W3C - authenticatorAttachment}
   */
  authenticatorAttachment?: AuthenticatorAttachment
  /**
   * The results of processing client extensions.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredential-getclientextensionresults W3C - getClientExtensionResults}
   */
  clientExtensionResults: AuthenticationExtensionsClientOutputs
  /**
   * The type of the credential (always "public-key").
   * @see {@link https://w3c.github.io/webauthn/#dom-credential-type W3C - type}
   */
  type: PublicKeyCredentialType
}

/**
 * A slightly-modified AuthenticatorAttestationResponse to simplify working with ArrayBuffers that
 * are Base64URL-encoded in the browser so that they can be sent as JSON to the server.
 *
 * @see {@link https://w3c.github.io/webauthn/#dictdef-authenticatorattestationresponsejson W3C WebAuthn Spec - AuthenticatorAttestationResponseJSON}
 */
export interface AuthenticatorAttestationResponseJSON {
  /**
   * JSON-serialized client data passed to the authenticator.
   * @see {@link https://w3c.github.io/webauthn/#dom-authenticatorresponse-clientdatajson W3C - clientDataJSON}
   */
  clientDataJSON: Base64URLString
  /**
   * The attestation object in base64url format.
   * @see {@link https://w3c.github.io/webauthn/#dom-authenticatorattestationresponse-attestationobject W3C - attestationObject}
   */
  attestationObject: Base64URLString
  /**
   * The authenticator data contained within the attestation object.
   * Optional in L2, but becomes required in L3. Play it safe until L3 becomes Recommendation
   * @see {@link https://w3c.github.io/webauthn/#dom-authenticatorattestationresponse-getauthenticatordata W3C - getAuthenticatorData}
   */
  authenticatorData?: Base64URLString
  /**
   * The transports that the authenticator supports.
   * Optional in L2, but becomes required in L3. Play it safe until L3 becomes Recommendation
   * @see {@link https://w3c.github.io/webauthn/#dom-authenticatorattestationresponse-gettransports W3C - getTransports}
   */
  transports?: AuthenticatorTransportFuture[]
  /**
   * The COSEAlgorithmIdentifier for the public key.
   * Optional in L2, but becomes required in L3. Play it safe until L3 becomes Recommendation
   * @see {@link https://w3c.github.io/webauthn/#dom-authenticatorattestationresponse-getpublickeyalgorithm W3C - getPublicKeyAlgorithm}
   */
  publicKeyAlgorithm?: COSEAlgorithmIdentifier
  /**
   * The public key in base64url format.
   * @see {@link https://w3c.github.io/webauthn/#dom-authenticatorattestationresponse-getpublickey W3C - getPublicKey}
   */
  publicKey?: Base64URLString
}

/**
 * A slightly-modified AuthenticatorAssertionResponse to simplify working with ArrayBuffers that
 * are Base64URL-encoded in the browser so that they can be sent as JSON to the server.
 *
 * @see {@link https://w3c.github.io/webauthn/#dictdef-authenticatorassertionresponsejson W3C WebAuthn Spec - AuthenticatorAssertionResponseJSON}
 */
export interface AuthenticatorAssertionResponseJSON {
  /**
   * JSON-serialized client data passed to the authenticator.
   * @see {@link https://w3c.github.io/webauthn/#dom-authenticatorresponse-clientdatajson W3C - clientDataJSON}
   */
  clientDataJSON: Base64URLString
  /**
   * The authenticator data returned by the authenticator.
   * @see {@link https://w3c.github.io/webauthn/#dom-authenticatorassertionresponse-authenticatordata W3C - authenticatorData}
   */
  authenticatorData: Base64URLString
  /**
   * The signature generated by the authenticator.
   * @see {@link https://w3c.github.io/webauthn/#dom-authenticatorassertionresponse-signature W3C - signature}
   */
  signature: Base64URLString
  /**
   * The user handle returned by the authenticator, if any.
   * @see {@link https://w3c.github.io/webauthn/#dom-authenticatorassertionresponse-userhandle W3C - userHandle}
   */
  userHandle?: Base64URLString
}

/**
 * Public key credential information needed to verify authentication responses.
 * Stores the credential's public key and metadata for server-side verification.
 *
 * @see {@link https://w3c.github.io/webauthn/#sctn-credential-storage-modality W3C WebAuthn Spec - Credential Storage}
 */
export type WebAuthnCredential = {
  /**
   * The credential ID in base64url format.
   * @see {@link https://w3c.github.io/webauthn/#credential-id W3C - Credential ID}
   */
  id: Base64URLString
  /**
   * The credential's public key.
   * @see {@link https://w3c.github.io/webauthn/#credential-public-key W3C - Credential Public Key}
   */
  publicKey: Uint8Array_
  /**
   * Number of times this authenticator is expected to have been used.
   * @see {@link https://w3c.github.io/webauthn/#signature-counter W3C - Signature Counter}
   */
  counter: number
  /**
   * The transports that the authenticator supports.
   * From browser's `startRegistration()` -> RegistrationCredentialJSON.transports (API L2 and up)
   * @see {@link https://w3c.github.io/webauthn/#dom-authenticatorattestationresponse-gettransports W3C - getTransports}
   */
  transports?: AuthenticatorTransportFuture[]
}

/**
 * An attempt to communicate that this isn't just any string, but a Base64URL-encoded string.
 * Base64URL encoding is used throughout WebAuthn for binary data transmission.
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc4648#section-5 RFC 4648 - Base64URL Encoding}
 */
export type Base64URLString = string

/**
 * AuthenticatorAttestationResponse in TypeScript's DOM lib is outdated (up through v3.9.7).
 * Maintain an augmented version here so we can implement additional properties as the WebAuthn
 * spec evolves.
 *
 * Properties marked optional are not supported in all browsers.
 *
 * @see {@link https://www.w3.org/TR/webauthn-2/#iface-authenticatorattestationresponse W3C WebAuthn Spec - AuthenticatorAttestationResponse}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AuthenticatorAttestationResponse MDN - AuthenticatorAttestationResponse}
 */
export interface AuthenticatorAttestationResponseFuture extends AuthenticatorAttestationResponse {
  /**
   * Returns the transports that the authenticator supports.
   * @see {@link https://w3c.github.io/webauthn/#dom-authenticatorattestationresponse-gettransports W3C - getTransports}
   */
  getTransports(): AuthenticatorTransportFuture[]
}

/**
 * A super class of TypeScript's `AuthenticatorTransport` that includes support for the latest
 * transports. Should eventually be replaced by TypeScript's when TypeScript gets updated to
 * know about it (sometime after 4.6.3)
 *
 * @see {@link https://w3c.github.io/webauthn/#enum-transport W3C WebAuthn Spec - AuthenticatorTransport}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AuthenticatorAttestationResponse/getTransports MDN - getTransports}
 */
export type AuthenticatorTransportFuture =
  | 'ble'
  | 'cable'
  | 'hybrid'
  | 'internal'
  | 'nfc'
  | 'smart-card'
  | 'usb'

/**
 * A super class of TypeScript's `PublicKeyCredentialDescriptor` that knows about the latest
 * transports. Should eventually be replaced by TypeScript's when TypeScript gets updated to
 * know about it (sometime after 4.6.3)
 *
 * @see {@link https://w3c.github.io/webauthn/#dictdef-publickeycredentialdescriptor W3C WebAuthn Spec - PublicKeyCredentialDescriptor}
 */
export interface PublicKeyCredentialDescriptorFuture
  extends Omit<PublicKeyCredentialDescriptor, 'transports'> {
  /**
   * How the authenticator communicates with clients.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialdescriptor-transports W3C - transports}
   */
  transports?: AuthenticatorTransportFuture[]
}

/**
 * Enhanced PublicKeyCredentialCreationOptions that knows about the latest features.
 * Used for WebAuthn registration ceremonies.
 *
 * @see {@link https://w3c.github.io/webauthn/#dictdef-publickeycredentialcreationoptions W3C WebAuthn Spec - PublicKeyCredentialCreationOptions}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialCreationOptions MDN - PublicKeyCredentialCreationOptions}
 */
export interface PublicKeyCredentialCreationOptionsFuture
  extends StrictOmit<PublicKeyCredentialCreationOptions, 'excludeCredentials' | 'user'> {
  /**
   * Credentials that the authenticator should not create a new credential for.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialcreationoptions-excludecredentials W3C - excludeCredentials}
   */
  excludeCredentials?: PublicKeyCredentialDescriptorFuture[]
  /**
   * Information about the user account for which the credential is being created.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialcreationoptions-user W3C - user}
   */
  user: PublicKeyCredentialUserEntity
  /**
   * Hints about what types of authenticators the user might want to use.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialcreationoptions-hints W3C - hints}
   */
  hints?: PublicKeyCredentialHint[]
  /**
   * Criteria for authenticator selection.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialcreationoptions-authenticatorselection W3C - authenticatorSelection}
   */
  authenticatorSelection?: AuthenticatorSelectionCriteria
  /**
   * Information about desired properties of the credential to be created.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialcreationoptions-pubkeycredparams W3C - pubKeyCredParams}
   */
  pubKeyCredParams: PublicKeyCredentialParameters[]
  /**
   * Information about the Relying Party responsible for the request.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialcreationoptions-rp W3C - rp}
   */
  rp: PublicKeyCredentialRpEntity
}

/**
 * Enhanced PublicKeyCredentialRequestOptions that knows about the latest features.
 * Used for WebAuthn authentication ceremonies.
 *
 * @see {@link https://w3c.github.io/webauthn/#dictdef-publickeycredentialrequestoptions W3C WebAuthn Spec - PublicKeyCredentialRequestOptions}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialRequestOptions MDN - PublicKeyCredentialRequestOptions}
 */
export interface PublicKeyCredentialRequestOptionsFuture
  extends StrictOmit<PublicKeyCredentialRequestOptions, 'allowCredentials'> {
  /**
   * A list of credentials acceptable for authentication.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialrequestoptions-allowcredentials W3C - allowCredentials}
   */
  allowCredentials?: PublicKeyCredentialDescriptorFuture[]
  /**
   * Hints about what types of authenticators the user might want to use.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialrequestoptions-hints W3C - hints}
   */
  hints?: PublicKeyCredentialHint[]
  /**
   * The attestation conveyance preference for the authentication ceremony.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredentialcreationoptions-attestation W3C - attestation}
   */
  attestation?: AttestationConveyancePreference
}

/**
 * Union type for all WebAuthn credential responses in JSON format.
 * Can be either a registration response (for new credentials) or authentication response (for existing credentials).
 */
export type PublicKeyCredentialJSON = RegistrationResponseJSON | AuthenticationResponseJSON

/**
 * A super class of TypeScript's `PublicKeyCredential` that knows about upcoming WebAuthn features.
 * Includes WebAuthn Level 3 methods for JSON serialization and parsing.
 *
 * @see {@link https://w3c.github.io/webauthn/#publickeycredential W3C WebAuthn Spec - PublicKeyCredential}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredential MDN - PublicKeyCredential}
 */
export interface PublicKeyCredentialFuture<
  T extends PublicKeyCredentialJSON = PublicKeyCredentialJSON,
> extends PublicKeyCredential {
  /**
   * The type of the credential (always "public-key").
   * @see {@link https://w3c.github.io/webauthn/#dom-credential-type W3C - type}
   */
  type: PublicKeyCredentialType
  /**
   * Checks if conditional mediation is available.
   * @see {@link https://github.com/w3c/webauthn/issues/1745 GitHub - Conditional Mediation}
   */
  isConditionalMediationAvailable?(): Promise<boolean>
  /**
   * Parses JSON to create PublicKeyCredentialCreationOptions.
   * @see {@link https://w3c.github.io/webauthn/#sctn-parseCreationOptionsFromJSON W3C - parseCreationOptionsFromJSON}
   */
  parseCreationOptionsFromJSON(
    options: PublicKeyCredentialCreationOptionsJSON
  ): PublicKeyCredentialCreationOptionsFuture
  /**
   * Parses JSON to create PublicKeyCredentialRequestOptions.
   * @see {@link https://w3c.github.io/webauthn/#sctn-parseRequestOptionsFromJSON W3C - parseRequestOptionsFromJSON}
   */
  parseRequestOptionsFromJSON(
    options: PublicKeyCredentialRequestOptionsJSON
  ): PublicKeyCredentialRequestOptionsFuture
  /**
   * Serializes the credential to JSON format.
   * @see {@link https://w3c.github.io/webauthn/#dom-publickeycredential-tojson W3C - toJSON}
   */
  toJSON(): T
}

/**
 * The two types of credentials as defined by bit 3 ("Backup Eligibility") in authenticator data:
 * - `"singleDevice"` credentials will never be backed up
 * - `"multiDevice"` credentials can be backed up
 *
 * @see {@link https://w3c.github.io/webauthn/#sctn-authenticator-data W3C WebAuthn Spec - Authenticator Data}
 */
export type CredentialDeviceType = 'singleDevice' | 'multiDevice'

/**
 * Categories of authenticators that Relying Parties can pass along to browsers during
 * registration. Browsers that understand these values can optimize their modal experience to
 * start the user off in a particular registration flow:
 *
 * - `hybrid`: A platform authenticator on a mobile device
 * - `security-key`: A portable FIDO2 authenticator capable of being used on multiple devices via a USB or NFC connection
 * - `client-device`: The device that WebAuthn is being called on. Typically synonymous with platform authenticators
 *
 * These values are less strict than `authenticatorAttachment`
 *
 * @see {@link https://w3c.github.io/webauthn/#enumdef-publickeycredentialhint W3C WebAuthn Spec - PublicKeyCredentialHint}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialCreationOptions#hints MDN - hints}
 */
export type PublicKeyCredentialHint = 'hybrid' | 'security-key' | 'client-device'

/**
 * Values for an attestation object's `fmt`.
 * Defines the format of the attestation statement from the authenticator.
 *
 * @see {@link https://www.iana.org/assignments/webauthn/webauthn.xhtml#webauthn-attestation-statement-format-ids IANA - WebAuthn Attestation Statement Format Identifiers}
 * @see {@link https://w3c.github.io/webauthn/#sctn-attestation-formats W3C WebAuthn Spec - Attestation Statement Formats}
 */
export type AttestationFormat =
  | 'fido-u2f'
  | 'packed'
  | 'android-safetynet'
  | 'android-key'
  | 'tpm'
  | 'apple'
  | 'none'

/**
 * Equivalent to `Uint8Array` before TypeScript 5.7, and `Uint8Array<ArrayBuffer>` in TypeScript 5.7
 * and beyond.
 *
 * **Context**
 *
 * `Uint8Array` became a generic type in TypeScript 5.7, requiring types defined simply as
 * `Uint8Array` to be refactored to `Uint8Array<ArrayBuffer>` starting in Deno 2.2. `Uint8Array` is
 * _not_ generic in Deno 2.1.x and earlier, though, so this type helps bridge this gap.
 *
 * Inspired by Deno's std library:
 *
 * https://github.com/denoland/std/blob/b5a5fe4f96b91c1fe8dba5cc0270092dd11d3287/bytes/_types.ts#L11
 */
export type Uint8Array_ = ReturnType<Uint8Array['slice']>

/**
 * Specifies the preferred authenticator attachment modality.
 * - `platform`: A platform authenticator attached to the client device (e.g., Touch ID, Windows Hello)
 * - `cross-platform`: A roaming authenticator not attached to the client device (e.g., USB security key)
 *
 * @see {@link https://w3c.github.io/webauthn/#enum-attachment W3C WebAuthn Spec - AuthenticatorAttachment}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialCreationOptions/authenticatorSelection#authenticatorattachment MDN - authenticatorAttachment}
 */
export type AuthenticatorAttachment = 'cross-platform' | 'platform'
