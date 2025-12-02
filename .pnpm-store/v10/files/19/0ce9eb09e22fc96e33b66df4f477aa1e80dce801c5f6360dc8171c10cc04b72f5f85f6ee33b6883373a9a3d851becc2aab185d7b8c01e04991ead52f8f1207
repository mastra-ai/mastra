"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withCompressionHeaders = withCompressionHeaders;
exports.withHttpSettings = withHttpSettings;
exports.isSuccessfulResponse = isSuccessfulResponse;
exports.isJWTAuth = isJWTAuth;
exports.isCredentialsAuth = isCredentialsAuth;
function withCompressionHeaders({ headers, enable_request_compression, enable_response_compression, }) {
    return {
        ...headers,
        ...(enable_response_compression ? { 'Accept-Encoding': 'gzip' } : {}),
        ...(enable_request_compression ? { 'Content-Encoding': 'gzip' } : {}),
    };
}
function withHttpSettings(clickhouse_settings, compression) {
    return {
        ...(compression
            ? {
                enable_http_compression: 1,
            }
            : {}),
        ...clickhouse_settings,
    };
}
function isSuccessfulResponse(statusCode) {
    return Boolean(statusCode && 200 <= statusCode && statusCode < 300);
}
function isJWTAuth(auth) {
    return auth !== null && typeof auth === 'object' && 'access_token' in auth;
}
function isCredentialsAuth(auth) {
    return (auth !== null &&
        typeof auth === 'object' &&
        'username' in auth &&
        'password' in auth);
}
//# sourceMappingURL=connection.js.map