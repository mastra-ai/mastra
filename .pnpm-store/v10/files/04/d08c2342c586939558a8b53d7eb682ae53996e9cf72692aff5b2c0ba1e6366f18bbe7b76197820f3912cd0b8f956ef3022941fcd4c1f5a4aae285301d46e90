"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleError = handleError;
exports._request = _request;
exports._sessionResponse = _sessionResponse;
exports._sessionResponsePassword = _sessionResponsePassword;
exports._userResponse = _userResponse;
exports._ssoResponse = _ssoResponse;
exports._generateLinkResponse = _generateLinkResponse;
exports._noResolveJsonResponse = _noResolveJsonResponse;
const tslib_1 = require("tslib");
const constants_1 = require("./constants");
const helpers_1 = require("./helpers");
const errors_1 = require("./errors");
const _getErrorMessage = (err) => err.msg || err.message || err.error_description || err.error || JSON.stringify(err);
const NETWORK_ERROR_CODES = [502, 503, 504];
async function handleError(error) {
    var _a;
    if (!(0, helpers_1.looksLikeFetchResponse)(error)) {
        throw new errors_1.AuthRetryableFetchError(_getErrorMessage(error), 0);
    }
    if (NETWORK_ERROR_CODES.includes(error.status)) {
        // status in 500...599 range - server had an error, request might be retryed.
        throw new errors_1.AuthRetryableFetchError(_getErrorMessage(error), error.status);
    }
    let data;
    try {
        data = await error.json();
    }
    catch (e) {
        throw new errors_1.AuthUnknownError(_getErrorMessage(e), e);
    }
    let errorCode = undefined;
    const responseAPIVersion = (0, helpers_1.parseResponseAPIVersion)(error);
    if (responseAPIVersion &&
        responseAPIVersion.getTime() >= constants_1.API_VERSIONS['2024-01-01'].timestamp &&
        typeof data === 'object' &&
        data &&
        typeof data.code === 'string') {
        errorCode = data.code;
    }
    else if (typeof data === 'object' && data && typeof data.error_code === 'string') {
        errorCode = data.error_code;
    }
    if (!errorCode) {
        // Legacy support for weak password errors, when there were no error codes
        if (typeof data === 'object' &&
            data &&
            typeof data.weak_password === 'object' &&
            data.weak_password &&
            Array.isArray(data.weak_password.reasons) &&
            data.weak_password.reasons.length &&
            data.weak_password.reasons.reduce((a, i) => a && typeof i === 'string', true)) {
            throw new errors_1.AuthWeakPasswordError(_getErrorMessage(data), error.status, data.weak_password.reasons);
        }
    }
    else if (errorCode === 'weak_password') {
        throw new errors_1.AuthWeakPasswordError(_getErrorMessage(data), error.status, ((_a = data.weak_password) === null || _a === void 0 ? void 0 : _a.reasons) || []);
    }
    else if (errorCode === 'session_not_found') {
        // The `session_id` inside the JWT does not correspond to a row in the
        // `sessions` table. This usually means the user has signed out, has been
        // deleted, or their session has somehow been terminated.
        throw new errors_1.AuthSessionMissingError();
    }
    throw new errors_1.AuthApiError(_getErrorMessage(data), error.status || 500, errorCode);
}
const _getRequestParams = (method, options, parameters, body) => {
    const params = { method, headers: (options === null || options === void 0 ? void 0 : options.headers) || {} };
    if (method === 'GET') {
        return params;
    }
    params.headers = Object.assign({ 'Content-Type': 'application/json;charset=UTF-8' }, options === null || options === void 0 ? void 0 : options.headers);
    params.body = JSON.stringify(body);
    return Object.assign(Object.assign({}, params), parameters);
};
async function _request(fetcher, method, url, options) {
    var _a;
    const headers = Object.assign({}, options === null || options === void 0 ? void 0 : options.headers);
    if (!headers[constants_1.API_VERSION_HEADER_NAME]) {
        headers[constants_1.API_VERSION_HEADER_NAME] = constants_1.API_VERSIONS['2024-01-01'].name;
    }
    if (options === null || options === void 0 ? void 0 : options.jwt) {
        headers['Authorization'] = `Bearer ${options.jwt}`;
    }
    const qs = (_a = options === null || options === void 0 ? void 0 : options.query) !== null && _a !== void 0 ? _a : {};
    if (options === null || options === void 0 ? void 0 : options.redirectTo) {
        qs['redirect_to'] = options.redirectTo;
    }
    const queryString = Object.keys(qs).length ? '?' + new URLSearchParams(qs).toString() : '';
    const data = await _handleRequest(fetcher, method, url + queryString, {
        headers,
        noResolveJson: options === null || options === void 0 ? void 0 : options.noResolveJson,
    }, {}, options === null || options === void 0 ? void 0 : options.body);
    return (options === null || options === void 0 ? void 0 : options.xform) ? options === null || options === void 0 ? void 0 : options.xform(data) : { data: Object.assign({}, data), error: null };
}
async function _handleRequest(fetcher, method, url, options, parameters, body) {
    const requestParams = _getRequestParams(method, options, parameters, body);
    let result;
    try {
        result = await fetcher(url, Object.assign({}, requestParams));
    }
    catch (e) {
        console.error(e);
        // fetch failed, likely due to a network or CORS error
        throw new errors_1.AuthRetryableFetchError(_getErrorMessage(e), 0);
    }
    if (!result.ok) {
        await handleError(result);
    }
    if (options === null || options === void 0 ? void 0 : options.noResolveJson) {
        return result;
    }
    try {
        return await result.json();
    }
    catch (e) {
        await handleError(e);
    }
}
function _sessionResponse(data) {
    var _a;
    let session = null;
    if (hasSession(data)) {
        session = Object.assign({}, data);
        if (!data.expires_at) {
            session.expires_at = (0, helpers_1.expiresAt)(data.expires_in);
        }
    }
    const user = (_a = data.user) !== null && _a !== void 0 ? _a : data;
    return { data: { session, user }, error: null };
}
function _sessionResponsePassword(data) {
    const response = _sessionResponse(data);
    if (!response.error &&
        data.weak_password &&
        typeof data.weak_password === 'object' &&
        Array.isArray(data.weak_password.reasons) &&
        data.weak_password.reasons.length &&
        data.weak_password.message &&
        typeof data.weak_password.message === 'string' &&
        data.weak_password.reasons.reduce((a, i) => a && typeof i === 'string', true)) {
        response.data.weak_password = data.weak_password;
    }
    return response;
}
function _userResponse(data) {
    var _a;
    const user = (_a = data.user) !== null && _a !== void 0 ? _a : data;
    return { data: { user }, error: null };
}
function _ssoResponse(data) {
    return { data, error: null };
}
function _generateLinkResponse(data) {
    const { action_link, email_otp, hashed_token, redirect_to, verification_type } = data, rest = tslib_1.__rest(data, ["action_link", "email_otp", "hashed_token", "redirect_to", "verification_type"]);
    const properties = {
        action_link,
        email_otp,
        hashed_token,
        redirect_to,
        verification_type,
    };
    const user = Object.assign({}, rest);
    return {
        data: {
            properties,
            user,
        },
        error: null,
    };
}
function _noResolveJsonResponse(data) {
    return data;
}
/**
 * hasSession checks if the response object contains a valid session
 * @param data A response object
 * @returns true if a session is in the response
 */
function hasSession(data) {
    return data.access_token && data.refresh_token && data.expires_in;
}
//# sourceMappingURL=fetch.js.map