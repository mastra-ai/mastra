"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpClientError = exports.HttpClientResponse = exports.HttpClient = void 0;
class HttpClient {
    constructor(baseURL, options) {
        this.baseURL = baseURL;
        this.options = options;
        this.MAX_RETRY_ATTEMPTS = 3;
        this.BACKOFF_MULTIPLIER = 1.5;
        this.MINIMUM_SLEEP_TIME_IN_MILLISECONDS = 500;
        this.RETRY_STATUS_CODES = [500, 502, 504];
        this.sleep = (retryAttempt) => new Promise((resolve) => setTimeout(resolve, this.getSleepTimeInMilliseconds(retryAttempt)));
    }
    /** The HTTP client name used for diagnostics */
    getClientName() {
        throw new Error('getClientName not implemented');
    }
    addClientToUserAgent(userAgent) {
        if (userAgent.indexOf(' ') > -1) {
            return userAgent.replace(/\b\s/, `/${this.getClientName()} `);
        }
        else {
            return (userAgent += `/${this.getClientName()}`);
        }
    }
    static getResourceURL(baseURL, path, params) {
        const queryString = HttpClient.getQueryString(params);
        const url = new URL([path, queryString].filter(Boolean).join('?'), baseURL);
        return url.toString();
    }
    static getQueryString(queryObj) {
        if (!queryObj)
            return undefined;
        const sanitizedQueryObj = {};
        Object.entries(queryObj).forEach(([param, value]) => {
            if (value !== '' && value !== undefined)
                sanitizedQueryObj[param] = value;
        });
        return new URLSearchParams(sanitizedQueryObj).toString();
    }
    static getContentTypeHeader(entity) {
        if (entity instanceof URLSearchParams) {
            return {
                'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
            };
        }
        return undefined;
    }
    static getBody(entity) {
        if (entity === null || entity instanceof URLSearchParams) {
            return entity;
        }
        return JSON.stringify(entity);
    }
    getSleepTimeInMilliseconds(retryAttempt) {
        const sleepTime = this.MINIMUM_SLEEP_TIME_IN_MILLISECONDS *
            Math.pow(this.BACKOFF_MULTIPLIER, retryAttempt);
        const jitter = Math.random() + 0.5;
        return sleepTime * jitter;
    }
}
exports.HttpClient = HttpClient;
// tslint:disable-next-line
class HttpClientResponse {
    constructor(statusCode, headers) {
        this._statusCode = statusCode;
        this._headers = headers;
    }
    getStatusCode() {
        return this._statusCode;
    }
    getHeaders() {
        return this._headers;
    }
}
exports.HttpClientResponse = HttpClientResponse;
// tslint:disable-next-line
class HttpClientError extends Error {
    constructor({ message, response, }) {
        super(message);
        this.name = 'HttpClientError';
        this.message = 'The request could not be completed.';
        this.message = message;
        this.response = response;
    }
}
exports.HttpClientError = HttpClientError;
