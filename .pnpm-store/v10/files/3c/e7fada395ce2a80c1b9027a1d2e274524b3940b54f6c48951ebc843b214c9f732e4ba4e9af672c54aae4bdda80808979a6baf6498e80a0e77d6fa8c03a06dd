/* eslint-disable @typescript-eslint/ban-ts-comment */

import { StrictOmit } from './types'
import { isValidDomain } from './webauthn'
import {
  PublicKeyCredentialCreationOptionsFuture,
  PublicKeyCredentialRequestOptionsFuture,
} from './webauthn.dom'

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
export class WebAuthnError extends Error {
  code: WebAuthnErrorCode

  protected __isWebAuthnError = true

  constructor({
    message,
    code,
    cause,
    name,
  }: {
    message: string
    code: WebAuthnErrorCode
    cause?: Error | unknown
    name?: string
  }) {
    // @ts-ignore: help Rollup understand that `cause` is okay to set
    super(message, { cause })
    this.name = name ?? (cause instanceof Error ? cause.name : undefined) ?? 'Unknown Error'
    this.code = code
  }
}

/**
 * Error class for unknown WebAuthn errors.
 * Wraps unexpected errors that don't match known WebAuthn error conditions.
 */
export class WebAuthnUnknownError extends WebAuthnError {
  originalError: unknown

  constructor(message: string, originalError: unknown) {
    super({
      code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
      cause: originalError,
      message,
    })
    this.name = 'WebAuthnUnknownError'
    this.originalError = originalError
  }
}

/**
 * Type guard to check if an error is a WebAuthnError.
 * @param {unknown} error - The error to check
 * @returns {boolean} True if the error is a WebAuthnError
 */
export function isWebAuthnError(error: unknown): error is WebAuthnError {
  return typeof error === 'object' && error !== null && '__isWebAuthnError' in error
}

/**
 * Error codes for WebAuthn operations.
 * These codes provide specific information about why a WebAuthn ceremony failed.
 * @see {@link https://w3c.github.io/webauthn/#sctn-defined-errors W3C WebAuthn Spec - Defined Errors}
 */
export type WebAuthnErrorCode =
  | 'ERROR_CEREMONY_ABORTED'
  | 'ERROR_INVALID_DOMAIN'
  | 'ERROR_INVALID_RP_ID'
  | 'ERROR_INVALID_USER_ID_LENGTH'
  | 'ERROR_MALFORMED_PUBKEYCREDPARAMS'
  | 'ERROR_AUTHENTICATOR_GENERAL_ERROR'
  | 'ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT'
  | 'ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT'
  | 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED'
  | 'ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG'
  | 'ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE'
  | 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY'

/**
 * Attempt to intuit _why_ an error was raised after calling `navigator.credentials.create()`.
 * Maps browser errors to specific WebAuthn error codes for better debugging.
 * @param {Object} params - Error identification parameters
 * @param {Error} params.error - The error thrown by the browser
 * @param {CredentialCreationOptions} params.options - The options passed to credentials.create()
 * @returns {WebAuthnError} A WebAuthnError with a specific error code
 * @see {@link https://w3c.github.io/webauthn/#sctn-createCredential W3C WebAuthn Spec - Create Credential}
 */
export function identifyRegistrationError({
  error,
  options,
}: {
  error: Error
  options: StrictOmit<CredentialCreationOptions, 'publicKey'> & {
    publicKey: PublicKeyCredentialCreationOptionsFuture
  }
}): WebAuthnError {
  const { publicKey } = options

  if (!publicKey) {
    throw Error('options was missing required publicKey property')
  }

  if (error.name === 'AbortError') {
    if (options.signal instanceof AbortSignal) {
      // https://www.w3.org/TR/webauthn-2/#sctn-createCredential (Step 16)
      return new WebAuthnError({
        message: 'Registration ceremony was sent an abort signal',
        code: 'ERROR_CEREMONY_ABORTED',
        cause: error,
      })
    }
  } else if (error.name === 'ConstraintError') {
    if (publicKey.authenticatorSelection?.requireResidentKey === true) {
      // https://www.w3.org/TR/webauthn-2/#sctn-op-make-cred (Step 4)
      return new WebAuthnError({
        message:
          'Discoverable credentials were required but no available authenticator supported it',
        code: 'ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT',
        cause: error,
      })
    } else if (
      // @ts-ignore: `mediation` doesn't yet exist on CredentialCreationOptions but it's possible as of Sept 2024
      options.mediation === 'conditional' &&
      publicKey.authenticatorSelection?.userVerification === 'required'
    ) {
      // https://w3c.github.io/webauthn/#sctn-createCredential (Step 22.4)
      return new WebAuthnError({
        message:
          'User verification was required during automatic registration but it could not be performed',
        code: 'ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE',
        cause: error,
      })
    } else if (publicKey.authenticatorSelection?.userVerification === 'required') {
      // https://www.w3.org/TR/webauthn-2/#sctn-op-make-cred (Step 5)
      return new WebAuthnError({
        message: 'User verification was required but no available authenticator supported it',
        code: 'ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT',
        cause: error,
      })
    }
  } else if (error.name === 'InvalidStateError') {
    // https://www.w3.org/TR/webauthn-2/#sctn-createCredential (Step 20)
    // https://www.w3.org/TR/webauthn-2/#sctn-op-make-cred (Step 3)
    return new WebAuthnError({
      message: 'The authenticator was previously registered',
      code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED',
      cause: error,
    })
  } else if (error.name === 'NotAllowedError') {
    /**
     * Pass the error directly through. Platforms are overloading this error beyond what the spec
     * defines and we don't want to overwrite potentially useful error messages.
     */
    return new WebAuthnError({
      message: error.message,
      code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
      cause: error,
    })
  } else if (error.name === 'NotSupportedError') {
    const validPubKeyCredParams = publicKey.pubKeyCredParams.filter(
      (param) => param.type === 'public-key'
    )

    if (validPubKeyCredParams.length === 0) {
      // https://www.w3.org/TR/webauthn-2/#sctn-createCredential (Step 10)
      return new WebAuthnError({
        message: 'No entry in pubKeyCredParams was of type "public-key"',
        code: 'ERROR_MALFORMED_PUBKEYCREDPARAMS',
        cause: error,
      })
    }

    // https://www.w3.org/TR/webauthn-2/#sctn-op-make-cred (Step 2)
    return new WebAuthnError({
      message:
        'No available authenticator supported any of the specified pubKeyCredParams algorithms',
      code: 'ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG',
      cause: error,
    })
  } else if (error.name === 'SecurityError') {
    const effectiveDomain = window.location.hostname
    if (!isValidDomain(effectiveDomain)) {
      // https://www.w3.org/TR/webauthn-2/#sctn-createCredential (Step 7)
      return new WebAuthnError({
        message: `${window.location.hostname} is an invalid domain`,
        code: 'ERROR_INVALID_DOMAIN',
        cause: error,
      })
    } else if (publicKey.rp.id !== effectiveDomain) {
      // https://www.w3.org/TR/webauthn-2/#sctn-createCredential (Step 8)
      return new WebAuthnError({
        message: `The RP ID "${publicKey.rp.id}" is invalid for this domain`,
        code: 'ERROR_INVALID_RP_ID',
        cause: error,
      })
    }
  } else if (error.name === 'TypeError') {
    if (publicKey.user.id.byteLength < 1 || publicKey.user.id.byteLength > 64) {
      // https://www.w3.org/TR/webauthn-2/#sctn-createCredential (Step 5)
      return new WebAuthnError({
        message: 'User ID was not between 1 and 64 characters',
        code: 'ERROR_INVALID_USER_ID_LENGTH',
        cause: error,
      })
    }
  } else if (error.name === 'UnknownError') {
    // https://www.w3.org/TR/webauthn-2/#sctn-op-make-cred (Step 1)
    // https://www.w3.org/TR/webauthn-2/#sctn-op-make-cred (Step 8)
    return new WebAuthnError({
      message:
        'The authenticator was unable to process the specified options, or could not create a new credential',
      code: 'ERROR_AUTHENTICATOR_GENERAL_ERROR',
      cause: error,
    })
  }

  return new WebAuthnError({
    message: 'a Non-Webauthn related error has occurred',
    code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
    cause: error,
  })
}

/**
 * Attempt to intuit _why_ an error was raised after calling `navigator.credentials.get()`.
 * Maps browser errors to specific WebAuthn error codes for better debugging.
 * @param {Object} params - Error identification parameters
 * @param {Error} params.error - The error thrown by the browser
 * @param {CredentialRequestOptions} params.options - The options passed to credentials.get()
 * @returns {WebAuthnError} A WebAuthnError with a specific error code
 * @see {@link https://w3c.github.io/webauthn/#sctn-getAssertion W3C WebAuthn Spec - Get Assertion}
 */
export function identifyAuthenticationError({
  error,
  options,
}: {
  error: Error
  options: StrictOmit<CredentialRequestOptions, 'publicKey'> & {
    publicKey: PublicKeyCredentialRequestOptionsFuture
  }
}): WebAuthnError {
  const { publicKey } = options

  if (!publicKey) {
    throw Error('options was missing required publicKey property')
  }

  if (error.name === 'AbortError') {
    if (options.signal instanceof AbortSignal) {
      // https://www.w3.org/TR/webauthn-2/#sctn-createCredential (Step 16)
      return new WebAuthnError({
        message: 'Authentication ceremony was sent an abort signal',
        code: 'ERROR_CEREMONY_ABORTED',
        cause: error,
      })
    }
  } else if (error.name === 'NotAllowedError') {
    /**
     * Pass the error directly through. Platforms are overloading this error beyond what the spec
     * defines and we don't want to overwrite potentially useful error messages.
     */
    return new WebAuthnError({
      message: error.message,
      code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
      cause: error,
    })
  } else if (error.name === 'SecurityError') {
    const effectiveDomain = window.location.hostname
    if (!isValidDomain(effectiveDomain)) {
      // https://www.w3.org/TR/webauthn-2/#sctn-discover-from-external-source (Step 5)
      return new WebAuthnError({
        message: `${window.location.hostname} is an invalid domain`,
        code: 'ERROR_INVALID_DOMAIN',
        cause: error,
      })
    } else if (publicKey.rpId !== effectiveDomain) {
      // https://www.w3.org/TR/webauthn-2/#sctn-discover-from-external-source (Step 6)
      return new WebAuthnError({
        message: `The RP ID "${publicKey.rpId}" is invalid for this domain`,
        code: 'ERROR_INVALID_RP_ID',
        cause: error,
      })
    }
  } else if (error.name === 'UnknownError') {
    // https://www.w3.org/TR/webauthn-2/#sctn-op-get-assertion (Step 1)
    // https://www.w3.org/TR/webauthn-2/#sctn-op-get-assertion (Step 12)
    return new WebAuthnError({
      message:
        'The authenticator was unable to process the specified options, or could not create a new assertion signature',
      code: 'ERROR_AUTHENTICATOR_GENERAL_ERROR',
      cause: error,
    })
  }

  return new WebAuthnError({
    message: 'a Non-Webauthn related error has occurred',
    code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
    cause: error,
  })
}
