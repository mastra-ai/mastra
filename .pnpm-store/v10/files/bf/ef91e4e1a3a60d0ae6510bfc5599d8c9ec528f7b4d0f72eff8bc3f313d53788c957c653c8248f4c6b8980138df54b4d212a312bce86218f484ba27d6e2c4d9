"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientAttributes = void 0;
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
function getClientAttributes(diag, options) {
    var _a, _b;
    return {
        [semantic_conventions_1.SEMATTRS_DB_SYSTEM]: semantic_conventions_1.DBSYSTEMVALUES_REDIS,
        [semantic_conventions_1.SEMATTRS_NET_PEER_NAME]: (_a = options === null || options === void 0 ? void 0 : options.socket) === null || _a === void 0 ? void 0 : _a.host,
        [semantic_conventions_1.SEMATTRS_NET_PEER_PORT]: (_b = options === null || options === void 0 ? void 0 : options.socket) === null || _b === void 0 ? void 0 : _b.port,
        [semantic_conventions_1.SEMATTRS_DB_CONNECTION_STRING]: removeCredentialsFromDBConnectionStringAttribute(diag, options === null || options === void 0 ? void 0 : options.url),
    };
}
exports.getClientAttributes = getClientAttributes;
/**
 * removeCredentialsFromDBConnectionStringAttribute removes basic auth from url and user_pwd from query string
 *
 * Examples:
 *   redis://user:pass@localhost:6379/mydb => redis://localhost:6379/mydb
 *   redis://localhost:6379?db=mydb&user_pwd=pass => redis://localhost:6379?db=mydb
 */
function removeCredentialsFromDBConnectionStringAttribute(diag, url) {
    if (typeof url !== 'string' || !url) {
        return;
    }
    try {
        const u = new URL(url);
        u.searchParams.delete('user_pwd');
        u.username = '';
        u.password = '';
        return u.href;
    }
    catch (err) {
        diag.error('failed to sanitize redis connection url', err);
    }
    return;
}
//# sourceMappingURL=utils.js.map