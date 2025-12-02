"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWSSignatureVerificationFailed = exports.JWKSTimeout = exports.JWKSMultipleMatchingKeys = exports.JWKSNoMatchingKey = exports.JWKSInvalid = exports.JWKInvalid = exports.JWTInvalid = exports.JWSInvalid = exports.JWEInvalid = exports.JWEDecryptionFailed = exports.JOSENotSupported = exports.JOSEAlgNotAllowed = exports.JWTExpired = exports.JWTClaimValidationFailed = exports.JOSEError = void 0;
class JOSEError extends Error {
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
exports.JOSEError = JOSEError;
class JWTClaimValidationFailed extends JOSEError {
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
exports.JWTClaimValidationFailed = JWTClaimValidationFailed;
class JWTExpired extends JOSEError {
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
exports.JWTExpired = JWTExpired;
class JOSEAlgNotAllowed extends JOSEError {
    static get code() {
        return 'ERR_JOSE_ALG_NOT_ALLOWED';
    }
    code = 'ERR_JOSE_ALG_NOT_ALLOWED';
}
exports.JOSEAlgNotAllowed = JOSEAlgNotAllowed;
class JOSENotSupported extends JOSEError {
    static get code() {
        return 'ERR_JOSE_NOT_SUPPORTED';
    }
    code = 'ERR_JOSE_NOT_SUPPORTED';
}
exports.JOSENotSupported = JOSENotSupported;
class JWEDecryptionFailed extends JOSEError {
    static get code() {
        return 'ERR_JWE_DECRYPTION_FAILED';
    }
    code = 'ERR_JWE_DECRYPTION_FAILED';
    message = 'decryption operation failed';
}
exports.JWEDecryptionFailed = JWEDecryptionFailed;
class JWEInvalid extends JOSEError {
    static get code() {
        return 'ERR_JWE_INVALID';
    }
    code = 'ERR_JWE_INVALID';
}
exports.JWEInvalid = JWEInvalid;
class JWSInvalid extends JOSEError {
    static get code() {
        return 'ERR_JWS_INVALID';
    }
    code = 'ERR_JWS_INVALID';
}
exports.JWSInvalid = JWSInvalid;
class JWTInvalid extends JOSEError {
    static get code() {
        return 'ERR_JWT_INVALID';
    }
    code = 'ERR_JWT_INVALID';
}
exports.JWTInvalid = JWTInvalid;
class JWKInvalid extends JOSEError {
    static get code() {
        return 'ERR_JWK_INVALID';
    }
    code = 'ERR_JWK_INVALID';
}
exports.JWKInvalid = JWKInvalid;
class JWKSInvalid extends JOSEError {
    static get code() {
        return 'ERR_JWKS_INVALID';
    }
    code = 'ERR_JWKS_INVALID';
}
exports.JWKSInvalid = JWKSInvalid;
class JWKSNoMatchingKey extends JOSEError {
    static get code() {
        return 'ERR_JWKS_NO_MATCHING_KEY';
    }
    code = 'ERR_JWKS_NO_MATCHING_KEY';
    message = 'no applicable key found in the JSON Web Key Set';
}
exports.JWKSNoMatchingKey = JWKSNoMatchingKey;
class JWKSMultipleMatchingKeys extends JOSEError {
    [Symbol.asyncIterator];
    static get code() {
        return 'ERR_JWKS_MULTIPLE_MATCHING_KEYS';
    }
    code = 'ERR_JWKS_MULTIPLE_MATCHING_KEYS';
    message = 'multiple matching keys found in the JSON Web Key Set';
}
exports.JWKSMultipleMatchingKeys = JWKSMultipleMatchingKeys;
class JWKSTimeout extends JOSEError {
    static get code() {
        return 'ERR_JWKS_TIMEOUT';
    }
    code = 'ERR_JWKS_TIMEOUT';
    message = 'request timed out';
}
exports.JWKSTimeout = JWKSTimeout;
class JWSSignatureVerificationFailed extends JOSEError {
    static get code() {
        return 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED';
    }
    code = 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED';
    message = 'signature verification failed';
}
exports.JWSSignatureVerificationFailed = JWSSignatureVerificationFailed;
