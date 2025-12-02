import type { JWTPayload, KeyLike } from '../types';
/**
 * A generic Error that all other JOSE specific Error subclasses extend.
 *
 */
export declare class JOSEError extends Error {
    /**
     * A unique error code for the particular error subclass.
     *
     * @ignore
     */
    static get code(): string;
    /** A unique error code for this particular error subclass. */
    code: string;
    /** @ignore */
    constructor(message?: string);
}
/**
 * An error subclass thrown when a JWT Claim Set member validation fails.
 *
 */
export declare class JWTClaimValidationFailed extends JOSEError {
    /** @ignore */
    static get code(): 'ERR_JWT_CLAIM_VALIDATION_FAILED';
    code: string;
    /** The Claim for which the validation failed. */
    claim: string;
    /** Reason code for the validation failure. */
    reason: string;
    /**
     * The parsed JWT Claims Set (aka payload). Other JWT claims may or may not have been verified at
     * this point. The JSON Web Signature (JWS) or a JSON Web Encryption (JWE) structures' integrity
     * has however been verified. Claims Set verification happens after the JWS Signature or JWE
     * Decryption processes.
     */
    payload: JWTPayload;
    /** @ignore */
    constructor(message: string, payload: JWTPayload, claim?: string, reason?: string);
}
/**
 * An error subclass thrown when a JWT is expired.
 *
 */
export declare class JWTExpired extends JOSEError implements JWTClaimValidationFailed {
    /** @ignore */
    static get code(): 'ERR_JWT_EXPIRED';
    code: string;
    /** The Claim for which the validation failed. */
    claim: string;
    /** Reason code for the validation failure. */
    reason: string;
    /**
     * The parsed JWT Claims Set (aka payload). Other JWT claims may or may not have been verified at
     * this point. The JSON Web Signature (JWS) or a JSON Web Encryption (JWE) structures' integrity
     * has however been verified. Claims Set verification happens after the JWS Signature or JWE
     * Decryption processes.
     */
    payload: JWTPayload;
    /** @ignore */
    constructor(message: string, payload: JWTPayload, claim?: string, reason?: string);
}
/**
 * An error subclass thrown when a JOSE Algorithm is not allowed per developer preference.
 *
 */
export declare class JOSEAlgNotAllowed extends JOSEError {
    /** @ignore */
    static get code(): 'ERR_JOSE_ALG_NOT_ALLOWED';
    code: string;
}
/**
 * An error subclass thrown when a particular feature or algorithm is not supported by this
 * implementation or JOSE in general.
 *
 */
export declare class JOSENotSupported extends JOSEError {
    /** @ignore */
    static get code(): 'ERR_JOSE_NOT_SUPPORTED';
    code: string;
}
/**
 * An error subclass thrown when a JWE ciphertext decryption fails.
 *
 */
export declare class JWEDecryptionFailed extends JOSEError {
    /** @ignore */
    static get code(): 'ERR_JWE_DECRYPTION_FAILED';
    code: string;
    message: string;
}
/**
 * An error subclass thrown when a JWE is invalid.
 *
 */
export declare class JWEInvalid extends JOSEError {
    /** @ignore */
    static get code(): 'ERR_JWE_INVALID';
    code: string;
}
/**
 * An error subclass thrown when a JWS is invalid.
 *
 */
export declare class JWSInvalid extends JOSEError {
    /** @ignore */
    static get code(): 'ERR_JWS_INVALID';
    code: string;
}
/**
 * An error subclass thrown when a JWT is invalid.
 *
 */
export declare class JWTInvalid extends JOSEError {
    /** @ignore */
    static get code(): 'ERR_JWT_INVALID';
    code: string;
}
/**
 * An error subclass thrown when a JWK is invalid.
 *
 */
export declare class JWKInvalid extends JOSEError {
    /** @ignore */
    static get code(): 'ERR_JWK_INVALID';
    code: string;
}
/**
 * An error subclass thrown when a JWKS is invalid.
 *
 */
export declare class JWKSInvalid extends JOSEError {
    /** @ignore */
    static get code(): 'ERR_JWKS_INVALID';
    code: string;
}
/**
 * An error subclass thrown when no keys match from a JWKS.
 *
 */
export declare class JWKSNoMatchingKey extends JOSEError {
    /** @ignore */
    static get code(): 'ERR_JWKS_NO_MATCHING_KEY';
    code: string;
    message: string;
}
/**
 * An error subclass thrown when multiple keys match from a JWKS.
 *
 */
export declare class JWKSMultipleMatchingKeys extends JOSEError {
    /** @ignore */
    [Symbol.asyncIterator]: () => AsyncIterableIterator<KeyLike>;
    static get code(): 'ERR_JWKS_MULTIPLE_MATCHING_KEYS';
    code: string;
    message: string;
}
/**
 * Timeout was reached when retrieving the JWKS response.
 *
 */
export declare class JWKSTimeout extends JOSEError {
    /** @ignore */
    static get code(): 'ERR_JWKS_TIMEOUT';
    code: string;
    message: string;
}
/**
 * An error subclass thrown when JWS signature verification fails.
 *
 */
export declare class JWSSignatureVerificationFailed extends JOSEError {
    /** @ignore */
    static get code(): 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED';
    code: string;
    message: string;
}
