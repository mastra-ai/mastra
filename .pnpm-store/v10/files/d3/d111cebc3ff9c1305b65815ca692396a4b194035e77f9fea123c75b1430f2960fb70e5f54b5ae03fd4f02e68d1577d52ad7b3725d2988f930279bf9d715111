"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnableToObtainNewCredentialsError = exports.CredentialsError = void 0;
/**
 * Thrown when re-authentication fails with provided credentials .
 * e.g. when the credentials are invalid, expired or revoked.
 *
 */
class CredentialsError extends Error {
    constructor(message) {
        super(`Re-authentication with latest credentials failed: ${message}`);
        this.name = 'CredentialsError';
    }
}
exports.CredentialsError = CredentialsError;
/**
 * Thrown when new credentials cannot be obtained before current ones expire
 */
class UnableToObtainNewCredentialsError extends Error {
    constructor(message) {
        super(`Unable to obtain new credentials : ${message}`);
        this.name = 'UnableToObtainNewCredentialsError';
    }
}
exports.UnableToObtainNewCredentialsError = UnableToObtainNewCredentialsError;
//# sourceMappingURL=credentials-provider.js.map