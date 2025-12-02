"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthInvalidJwtError = exports.AuthWeakPasswordError = exports.AuthRetryableFetchError = exports.AuthPKCEGrantCodeExchangeError = exports.AuthImplicitGrantRedirectError = exports.AuthInvalidCredentialsError = exports.AuthInvalidTokenResponseError = exports.AuthSessionMissingError = exports.CustomAuthError = exports.AuthUnknownError = exports.AuthApiError = exports.AuthError = void 0;
exports.isAuthError = isAuthError;
exports.isAuthApiError = isAuthApiError;
exports.isAuthSessionMissingError = isAuthSessionMissingError;
exports.isAuthImplicitGrantRedirectError = isAuthImplicitGrantRedirectError;
exports.isAuthRetryableFetchError = isAuthRetryableFetchError;
exports.isAuthWeakPasswordError = isAuthWeakPasswordError;
class AuthError extends Error {
    constructor(message, status, code) {
        super(message);
        this.__isAuthError = true;
        this.name = 'AuthError';
        this.status = status;
        this.code = code;
    }
}
exports.AuthError = AuthError;
function isAuthError(error) {
    return typeof error === 'object' && error !== null && '__isAuthError' in error;
}
class AuthApiError extends AuthError {
    constructor(message, status, code) {
        super(message, status, code);
        this.name = 'AuthApiError';
        this.status = status;
        this.code = code;
    }
}
exports.AuthApiError = AuthApiError;
function isAuthApiError(error) {
    return isAuthError(error) && error.name === 'AuthApiError';
}
class AuthUnknownError extends AuthError {
    constructor(message, originalError) {
        super(message);
        this.name = 'AuthUnknownError';
        this.originalError = originalError;
    }
}
exports.AuthUnknownError = AuthUnknownError;
class CustomAuthError extends AuthError {
    constructor(message, name, status, code) {
        super(message, status, code);
        this.name = name;
        this.status = status;
    }
}
exports.CustomAuthError = CustomAuthError;
class AuthSessionMissingError extends CustomAuthError {
    constructor() {
        super('Auth session missing!', 'AuthSessionMissingError', 400, undefined);
    }
}
exports.AuthSessionMissingError = AuthSessionMissingError;
function isAuthSessionMissingError(error) {
    return isAuthError(error) && error.name === 'AuthSessionMissingError';
}
class AuthInvalidTokenResponseError extends CustomAuthError {
    constructor() {
        super('Auth session or user missing', 'AuthInvalidTokenResponseError', 500, undefined);
    }
}
exports.AuthInvalidTokenResponseError = AuthInvalidTokenResponseError;
class AuthInvalidCredentialsError extends CustomAuthError {
    constructor(message) {
        super(message, 'AuthInvalidCredentialsError', 400, undefined);
    }
}
exports.AuthInvalidCredentialsError = AuthInvalidCredentialsError;
class AuthImplicitGrantRedirectError extends CustomAuthError {
    constructor(message, details = null) {
        super(message, 'AuthImplicitGrantRedirectError', 500, undefined);
        this.details = null;
        this.details = details;
    }
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            status: this.status,
            details: this.details,
        };
    }
}
exports.AuthImplicitGrantRedirectError = AuthImplicitGrantRedirectError;
function isAuthImplicitGrantRedirectError(error) {
    return isAuthError(error) && error.name === 'AuthImplicitGrantRedirectError';
}
class AuthPKCEGrantCodeExchangeError extends CustomAuthError {
    constructor(message, details = null) {
        super(message, 'AuthPKCEGrantCodeExchangeError', 500, undefined);
        this.details = null;
        this.details = details;
    }
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            status: this.status,
            details: this.details,
        };
    }
}
exports.AuthPKCEGrantCodeExchangeError = AuthPKCEGrantCodeExchangeError;
class AuthRetryableFetchError extends CustomAuthError {
    constructor(message, status) {
        super(message, 'AuthRetryableFetchError', status, undefined);
    }
}
exports.AuthRetryableFetchError = AuthRetryableFetchError;
function isAuthRetryableFetchError(error) {
    return isAuthError(error) && error.name === 'AuthRetryableFetchError';
}
/**
 * This error is thrown on certain methods when the password used is deemed
 * weak. Inspect the reasons to identify what password strength rules are
 * inadequate.
 */
class AuthWeakPasswordError extends CustomAuthError {
    constructor(message, status, reasons) {
        super(message, 'AuthWeakPasswordError', status, 'weak_password');
        this.reasons = reasons;
    }
}
exports.AuthWeakPasswordError = AuthWeakPasswordError;
function isAuthWeakPasswordError(error) {
    return isAuthError(error) && error.name === 'AuthWeakPasswordError';
}
class AuthInvalidJwtError extends CustomAuthError {
    constructor(message) {
        super(message, 'AuthInvalidJwtError', 400, 'invalid_jwt');
    }
}
exports.AuthInvalidJwtError = AuthInvalidJwtError;
//# sourceMappingURL=errors.js.map