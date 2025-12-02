"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.get = get;
exports.post = post;
exports.put = put;
exports.head = head;
exports.remove = remove;
const tslib_1 = require("tslib");
const errors_1 = require("./errors");
const helpers_1 = require("./helpers");
const _getErrorMessage = (err) => err.msg || err.message || err.error_description || err.error || JSON.stringify(err);
const handleError = (error, reject, options) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    const Res = yield (0, helpers_1.resolveResponse)();
    if (error instanceof Res && !(options === null || options === void 0 ? void 0 : options.noResolveJson)) {
        error
            .json()
            .then((err) => {
            const status = error.status || 500;
            const statusCode = (err === null || err === void 0 ? void 0 : err.statusCode) || status + '';
            reject(new errors_1.StorageApiError(_getErrorMessage(err), status, statusCode));
        })
            .catch((err) => {
            reject(new errors_1.StorageUnknownError(_getErrorMessage(err), err));
        });
    }
    else {
        reject(new errors_1.StorageUnknownError(_getErrorMessage(error), error));
    }
});
const _getRequestParams = (method, options, parameters, body) => {
    const params = { method, headers: (options === null || options === void 0 ? void 0 : options.headers) || {} };
    if (method === 'GET' || !body) {
        return params;
    }
    if ((0, helpers_1.isPlainObject)(body)) {
        params.headers = Object.assign({ 'Content-Type': 'application/json' }, options === null || options === void 0 ? void 0 : options.headers);
        params.body = JSON.stringify(body);
    }
    else {
        params.body = body;
    }
    if (options === null || options === void 0 ? void 0 : options.duplex) {
        params.duplex = options.duplex;
    }
    return Object.assign(Object.assign({}, params), parameters);
};
function _handleRequest(fetcher, method, url, options, parameters, body) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            fetcher(url, _getRequestParams(method, options, parameters, body))
                .then((result) => {
                if (!result.ok)
                    throw result;
                if (options === null || options === void 0 ? void 0 : options.noResolveJson)
                    return result;
                return result.json();
            })
                .then((data) => resolve(data))
                .catch((error) => handleError(error, reject, options));
        });
    });
}
function get(fetcher, url, options, parameters) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        return _handleRequest(fetcher, 'GET', url, options, parameters);
    });
}
function post(fetcher, url, body, options, parameters) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        return _handleRequest(fetcher, 'POST', url, options, parameters, body);
    });
}
function put(fetcher, url, body, options, parameters) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        return _handleRequest(fetcher, 'PUT', url, options, parameters, body);
    });
}
function head(fetcher, url, options, parameters) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        return _handleRequest(fetcher, 'HEAD', url, Object.assign(Object.assign({}, options), { noResolveJson: true }), parameters);
    });
}
function remove(fetcher, url, body, options, parameters) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        return _handleRequest(fetcher, 'DELETE', url, options, parameters, body);
    });
}
//# sourceMappingURL=fetch.js.map