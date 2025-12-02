import { __awaiter } from "tslib";
import { StorageVectorsApiError, StorageVectorsUnknownError } from './errors';
import { isPlainObject } from './helpers';
/**
 * Extracts error message from various error response formats
 * @param err - Error object from API
 * @returns Human-readable error message
 */
const _getErrorMessage = (err) => err.msg || err.message || err.error_description || err.error || JSON.stringify(err);
/**
 * Handles fetch errors and converts them to StorageVectors error types
 * @param error - The error caught from fetch
 * @param reject - Promise rejection function
 * @param options - Fetch options that may affect error handling
 */
const handleError = (error, reject, options) => __awaiter(void 0, void 0, void 0, function* () {
    // Check if error is a Response-like object (has status and ok properties)
    // This is more reliable than instanceof which can fail across realms
    const isResponseLike = error &&
        typeof error === 'object' &&
        'status' in error &&
        'ok' in error &&
        typeof error.status === 'number';
    if (isResponseLike && !(options === null || options === void 0 ? void 0 : options.noResolveJson)) {
        const status = error.status || 500;
        const responseError = error;
        // Try to parse JSON body if available
        if (typeof responseError.json === 'function') {
            responseError
                .json()
                .then((err) => {
                const statusCode = (err === null || err === void 0 ? void 0 : err.statusCode) || (err === null || err === void 0 ? void 0 : err.code) || status + '';
                reject(new StorageVectorsApiError(_getErrorMessage(err), status, statusCode));
            })
                .catch(() => {
                // If JSON parsing fails, create an ApiError with the HTTP status code
                const statusCode = status + '';
                const message = responseError.statusText || `HTTP ${status} error`;
                reject(new StorageVectorsApiError(message, status, statusCode));
            });
        }
        else {
            // No json() method available, create error from status
            const statusCode = status + '';
            const message = responseError.statusText || `HTTP ${status} error`;
            reject(new StorageVectorsApiError(message, status, statusCode));
        }
    }
    else {
        reject(new StorageVectorsUnknownError(_getErrorMessage(error), error));
    }
});
/**
 * Builds request parameters for fetch calls
 * @param method - HTTP method
 * @param options - Custom fetch options
 * @param parameters - Additional fetch parameters like AbortSignal
 * @param body - Request body (will be JSON stringified if plain object)
 * @returns Complete fetch request parameters
 */
const _getRequestParams = (method, options, parameters, body) => {
    const params = { method, headers: (options === null || options === void 0 ? void 0 : options.headers) || {} };
    if (method === 'GET' || !body) {
        return params;
    }
    if (isPlainObject(body)) {
        params.headers = Object.assign({ 'Content-Type': 'application/json' }, options === null || options === void 0 ? void 0 : options.headers);
        params.body = JSON.stringify(body);
    }
    else {
        params.body = body;
    }
    return Object.assign(Object.assign({}, params), parameters);
};
/**
 * Internal request handler that wraps fetch with error handling
 * @param fetcher - Fetch function to use
 * @param method - HTTP method
 * @param url - Request URL
 * @param options - Custom fetch options
 * @param parameters - Additional fetch parameters
 * @param body - Request body
 * @returns Promise with parsed response or error
 */
function _handleRequest(fetcher, method, url, options, parameters, body) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            fetcher(url, _getRequestParams(method, options, parameters, body))
                .then((result) => {
                if (!result.ok)
                    throw result;
                if (options === null || options === void 0 ? void 0 : options.noResolveJson)
                    return result;
                // Handle empty responses (204, empty body)
                const contentType = result.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    return {};
                }
                return result.json();
            })
                .then((data) => resolve(data))
                .catch((error) => handleError(error, reject, options));
        });
    });
}
/**
 * Performs a GET request
 * @param fetcher - Fetch function to use
 * @param url - Request URL
 * @param options - Custom fetch options
 * @param parameters - Additional fetch parameters
 * @returns Promise with parsed response
 */
export function get(fetcher, url, options, parameters) {
    return __awaiter(this, void 0, void 0, function* () {
        return _handleRequest(fetcher, 'GET', url, options, parameters);
    });
}
/**
 * Performs a POST request
 * @param fetcher - Fetch function to use
 * @param url - Request URL
 * @param body - Request body to be JSON stringified
 * @param options - Custom fetch options
 * @param parameters - Additional fetch parameters
 * @returns Promise with parsed response
 */
export function post(fetcher, url, body, options, parameters) {
    return __awaiter(this, void 0, void 0, function* () {
        return _handleRequest(fetcher, 'POST', url, options, parameters, body);
    });
}
/**
 * Performs a PUT request
 * @param fetcher - Fetch function to use
 * @param url - Request URL
 * @param body - Request body to be JSON stringified
 * @param options - Custom fetch options
 * @param parameters - Additional fetch parameters
 * @returns Promise with parsed response
 */
export function put(fetcher, url, body, options, parameters) {
    return __awaiter(this, void 0, void 0, function* () {
        return _handleRequest(fetcher, 'PUT', url, options, parameters, body);
    });
}
/**
 * Performs a DELETE request
 * @param fetcher - Fetch function to use
 * @param url - Request URL
 * @param body - Request body to be JSON stringified
 * @param options - Custom fetch options
 * @param parameters - Additional fetch parameters
 * @returns Promise with parsed response
 */
export function remove(fetcher, url, body, options, parameters) {
    return __awaiter(this, void 0, void 0, function* () {
        return _handleRequest(fetcher, 'DELETE', url, options, parameters, body);
    });
}
//# sourceMappingURL=fetch.js.map