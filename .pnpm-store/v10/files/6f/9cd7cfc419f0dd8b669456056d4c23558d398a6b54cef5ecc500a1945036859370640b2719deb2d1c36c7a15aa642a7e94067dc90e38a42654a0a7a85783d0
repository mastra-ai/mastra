export class JOSEError extends Error {
    static get code() {
        return 'ERR_JOSE_GENERIC';
    }
    code = 'ERR_JOSE_GENERIC';
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace?.(this, this.constructor);
    }
}
export class JWTClaimValidationFailed extends JOSEError {
    static get code() {
        return 'ERR_JWT_CLAIM_VALIDATION_FAILED';
    }
    code = 'ERR_JWT_CLAIM_VALIDATION_FAILED';
    claim;
    reason;
    payload;
    constructor(message, payload, claim = 'unspecified', reason = 'unspecified') {
        super(message);
        this.claim = claim;
        this.reason = reason;
        this.payload = payload;
    }
}
export class JWTExpired extends JOSEError {
    static get code() {
        return 'ERR_JWT_EXPIRED';
    }
    code = 'ERR_JWT_EXPIRED';
    claim;
    reason;
    payload;
    constructor(message, payload, claim = 'unspecified', reason = 'unspecified') {
        super(message);
        this.claim = claim;
        this.reason = reason;
        this.payload = payload;
    }
}
export class JOSEAlgNotAllowed extends JOSEError {
    static get code() {
        return 'ERR_JOSE_ALG_NOT_ALLOWED';
    }
    code = 'ERR_JOSE_ALG_NOT_ALLOWED';
}
export class JOSENotSupported extends JOSEError {
    static get code() {
        return 'ERR_JOSE_NOT_SUPPORTED';
    }
    code = 'ERR_JOSE_NOT_SUPPORTED';
}
export class JWEDecryptionFailed extends JOSEError {
    static get code() {
        return 'ERR_JWE_DECRYPTION_FAILED';
    }
    code = 'ERR_JWE_DECRYPTION_FAILED';
    message = 'decryption operation failed';
}
export class JWEInvalid extends JOSEError {
    static get code() {
        return 'ERR_JWE_INVALID';
    }
    code = 'ERR_JWE_INVALID';
}
export class JWSInvalid extends JOSEError {
    static get code() {
        return 'ERR_JWS_INVALID';
    }
    code = 'ERR_JWS_INVALID';
}
export class JWTInvalid extends JOSEError {
    static get code() {
        return 'ERR_JWT_INVALID';
    }
    code = 'ERR_JWT_INVALID';
}
export class JWKInvalid extends JOSEError {
    static get code() {
        return 'ERR_JWK_INVALID';
    }
    code = 'ERR_JWK_INVALID';
}
export class JWKSInvalid extends JOSEError {
    static get code() {
        return 'ERR_JWKS_INVALID';
    }
    code = 'ERR_JWKS_INVALID';
}
export class JWKSNoMatchingKey extends JOSEError {
    static get code() {
        return 'ERR_JWKS_NO_MATCHING_KEY';
    }
    code = 'ERR_JWKS_NO_MATCHING_KEY';
    message = 'no applicable key found in the JSON Web Key Set';
}
export class JWKSMultipleMatchingKeys extends JOSEError {
    [Symbol.asyncIterator];
    static get code() {
        return 'ERR_JWKS_MULTIPLE_MATCHING_KEYS';
    }
    code = 'ERR_JWKS_MULTIPLE_MATCHING_KEYS';
    message = 'multiple matching keys found in the JSON Web Key Set';
}
export class JWKSTimeout extends JOSEError {
    static get code() {
        return 'ERR_JWKS_TIMEOUT';
    }
    code = 'ERR_JWKS_TIMEOUT';
    message = 'request timed out';
}
export class JWSSignatureVerificationFailed extends JOSEError {
    static get code() {
        return 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED';
    }
    code = 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED';
    message = 'signature verification failed';
}
