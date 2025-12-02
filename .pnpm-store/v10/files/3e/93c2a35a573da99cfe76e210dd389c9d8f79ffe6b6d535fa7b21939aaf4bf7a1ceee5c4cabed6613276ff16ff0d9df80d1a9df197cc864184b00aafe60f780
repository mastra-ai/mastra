"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.headerCapture = exports.getIncomingStableRequestMetricAttributesOnResponse = exports.getIncomingRequestMetricAttributesOnResponse = exports.getIncomingRequestAttributesOnResponse = exports.getIncomingRequestMetricAttributes = exports.getIncomingRequestAttributes = exports.getRemoteClientAddress = exports.getOutgoingRequestMetricAttributesOnResponse = exports.getOutgoingRequestAttributesOnResponse = exports.setAttributesFromHttpKind = exports.getOutgoingRequestMetricAttributes = exports.getOutgoingRequestAttributes = exports.extractHostnameAndPort = exports.isValidOptionsType = exports.getRequestInfo = exports.isCompressed = exports.setResponseContentLengthAttribute = exports.setRequestContentLengthAttribute = exports.setSpanWithError = exports.satisfiesPattern = exports.parseResponseStatus = exports.getAbsoluteUrl = void 0;
/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const api_1 = require("@opentelemetry/api");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const core_1 = require("@opentelemetry/core");
const url = require("url");
const AttributeNames_1 = require("./enums/AttributeNames");
const forwardedParse = require("forwarded-parse");
/**
 * Get an absolute url
 */
const getAbsoluteUrl = (requestUrl, headers, fallbackProtocol = 'http:') => {
    const reqUrlObject = requestUrl || {};
    const protocol = reqUrlObject.protocol || fallbackProtocol;
    const port = (reqUrlObject.port || '').toString();
    const path = reqUrlObject.path || '/';
    let host = reqUrlObject.host || reqUrlObject.hostname || headers.host || 'localhost';
    // if there is no port in host and there is a port
    // it should be displayed if it's not 80 and 443 (default ports)
    if (host.indexOf(':') === -1 &&
        port &&
        port !== '80' &&
        port !== '443') {
        host += `:${port}`;
    }
    return `${protocol}//${host}${path}`;
};
exports.getAbsoluteUrl = getAbsoluteUrl;
/**
 * Parse status code from HTTP response. [More details](https://github.com/open-telemetry/opentelemetry-specification/blob/master/specification/data-http.md#status)
 */
const parseResponseStatus = (kind, statusCode) => {
    const upperBound = kind === api_1.SpanKind.CLIENT ? 400 : 500;
    // 1xx, 2xx, 3xx are OK on client and server
    // 4xx is OK on server
    if (statusCode && statusCode >= 100 && statusCode < upperBound) {
        return api_1.SpanStatusCode.UNSET;
    }
    // All other codes are error
    return api_1.SpanStatusCode.ERROR;
};
exports.parseResponseStatus = parseResponseStatus;
/**
 * Check whether the given obj match pattern
 * @param constant e.g URL of request
 * @param pattern Match pattern
 */
const satisfiesPattern = (constant, pattern) => {
    if (typeof pattern === 'string') {
        return pattern === constant;
    }
    else if (pattern instanceof RegExp) {
        return pattern.test(constant);
    }
    else if (typeof pattern === 'function') {
        return pattern(constant);
    }
    else {
        throw new TypeError('Pattern is in unsupported datatype');
    }
};
exports.satisfiesPattern = satisfiesPattern;
/**
 * Sets the span with the error passed in params
 * @param {Span} span the span that need to be set
 * @param {Error} error error that will be set to span
 * @param {SemconvStability} semconvStability determines which semconv version to use
 */
const setSpanWithError = (span, error, semconvStability) => {
    const message = error.message;
    if ((semconvStability & 2 /* OLD */) === 2 /* OLD */) {
        span.setAttribute(AttributeNames_1.AttributeNames.HTTP_ERROR_NAME, error.name);
        span.setAttribute(AttributeNames_1.AttributeNames.HTTP_ERROR_MESSAGE, message);
    }
    if ((semconvStability & 1 /* STABLE */) ===
        1 /* STABLE */) {
        span.setAttribute(semantic_conventions_1.ATTR_ERROR_TYPE, error.name);
    }
    span.setStatus({ code: api_1.SpanStatusCode.ERROR, message });
    span.recordException(error);
};
exports.setSpanWithError = setSpanWithError;
/**
 * Adds attributes for request content-length and content-encoding HTTP headers
 * @param { IncomingMessage } Request object whose headers will be analyzed
 * @param { Attributes } Attributes object to be modified
 */
const setRequestContentLengthAttribute = (request, attributes) => {
    const length = getContentLength(request.headers);
    if (length === null)
        return;
    if ((0, exports.isCompressed)(request.headers)) {
        attributes[semantic_conventions_1.SEMATTRS_HTTP_REQUEST_CONTENT_LENGTH] = length;
    }
    else {
        attributes[semantic_conventions_1.SEMATTRS_HTTP_REQUEST_CONTENT_LENGTH_UNCOMPRESSED] = length;
    }
};
exports.setRequestContentLengthAttribute = setRequestContentLengthAttribute;
/**
 * Adds attributes for response content-length and content-encoding HTTP headers
 * @param { IncomingMessage } Response object whose headers will be analyzed
 * @param { Attributes } Attributes object to be modified
 *
 * @deprecated this is for an older version of semconv. It is retained for compatibility using OTEL_SEMCONV_STABILITY_OPT_IN
 */
const setResponseContentLengthAttribute = (response, attributes) => {
    const length = getContentLength(response.headers);
    if (length === null)
        return;
    if ((0, exports.isCompressed)(response.headers)) {
        attributes[semantic_conventions_1.SEMATTRS_HTTP_RESPONSE_CONTENT_LENGTH] = length;
    }
    else {
        attributes[semantic_conventions_1.SEMATTRS_HTTP_RESPONSE_CONTENT_LENGTH_UNCOMPRESSED] = length;
    }
};
exports.setResponseContentLengthAttribute = setResponseContentLengthAttribute;
function getContentLength(headers) {
    const contentLengthHeader = headers['content-length'];
    if (contentLengthHeader === undefined)
        return null;
    const contentLength = parseInt(contentLengthHeader, 10);
    if (isNaN(contentLength))
        return null;
    return contentLength;
}
const isCompressed = (headers) => {
    const encoding = headers['content-encoding'];
    return !!encoding && encoding !== 'identity';
};
exports.isCompressed = isCompressed;
/**
 * Mimics Node.js conversion of URL strings to RequestOptions expected by
 * `http.request` and `https.request` APIs.
 *
 * See https://github.com/nodejs/node/blob/2505e217bba05fc581b572c685c5cf280a16c5a3/lib/internal/url.js#L1415-L1437
 *
 * @param stringUrl
 * @throws TypeError if the URL is not valid.
 */
function stringUrlToHttpOptions(stringUrl) {
    // This is heavily inspired by Node.js handling of the same situation, trying
    // to follow it as closely as possible while keeping in mind that we only
    // deal with string URLs, not URL objects.
    const { hostname, pathname, port, username, password, search, protocol, hash, href, origin, host, } = new URL(stringUrl);
    const options = {
        protocol: protocol,
        hostname: hostname && hostname[0] === '[' ? hostname.slice(1, -1) : hostname,
        hash: hash,
        search: search,
        pathname: pathname,
        path: `${pathname || ''}${search || ''}`,
        href: href,
        origin: origin,
        host: host,
    };
    if (port !== '') {
        options.port = Number(port);
    }
    if (username || password) {
        options.auth = `${decodeURIComponent(username)}:${decodeURIComponent(password)}`;
    }
    return options;
}
/**
 * Makes sure options is an url object
 * return an object with default value and parsed options
 * @param logger component logger
 * @param options original options for the request
 * @param [extraOptions] additional options for the request
 */
const getRequestInfo = (logger, options, extraOptions) => {
    let pathname;
    let origin;
    let optionsParsed;
    let invalidUrl = false;
    if (typeof options === 'string') {
        try {
            const convertedOptions = stringUrlToHttpOptions(options);
            optionsParsed = convertedOptions;
            pathname = convertedOptions.pathname || '/';
        }
        catch (e) {
            invalidUrl = true;
            logger.verbose('Unable to parse URL provided to HTTP request, using fallback to determine path. Original error:', e);
            // for backward compatibility with how url.parse() behaved.
            optionsParsed = {
                path: options,
            };
            pathname = optionsParsed.path || '/';
        }
        origin = `${optionsParsed.protocol || 'http:'}//${optionsParsed.host}`;
        if (extraOptions !== undefined) {
            Object.assign(optionsParsed, extraOptions);
        }
    }
    else if (options instanceof url.URL) {
        optionsParsed = {
            protocol: options.protocol,
            hostname: typeof options.hostname === 'string' && options.hostname.startsWith('[')
                ? options.hostname.slice(1, -1)
                : options.hostname,
            path: `${options.pathname || ''}${options.search || ''}`,
        };
        if (options.port !== '') {
            optionsParsed.port = Number(options.port);
        }
        if (options.username || options.password) {
            optionsParsed.auth = `${options.username}:${options.password}`;
        }
        pathname = options.pathname;
        origin = options.origin;
        if (extraOptions !== undefined) {
            Object.assign(optionsParsed, extraOptions);
        }
    }
    else {
        optionsParsed = Object.assign({ protocol: options.host ? 'http:' : undefined }, options);
        const hostname = optionsParsed.host ||
            (optionsParsed.port != null
                ? `${optionsParsed.hostname}${optionsParsed.port}`
                : optionsParsed.hostname);
        origin = `${optionsParsed.protocol || 'http:'}//${hostname}`;
        pathname = options.pathname;
        if (!pathname && optionsParsed.path) {
            try {
                const parsedUrl = new URL(optionsParsed.path, origin);
                pathname = parsedUrl.pathname || '/';
            }
            catch (e) {
                pathname = '/';
            }
        }
    }
    // some packages return method in lowercase..
    // ensure upperCase for consistency
    const method = optionsParsed.method
        ? optionsParsed.method.toUpperCase()
        : 'GET';
    return { origin, pathname, method, optionsParsed, invalidUrl };
};
exports.getRequestInfo = getRequestInfo;
/**
 * Makes sure options is of type string or object
 * @param options for the request
 */
const isValidOptionsType = (options) => {
    if (!options) {
        return false;
    }
    const type = typeof options;
    return type === 'string' || (type === 'object' && !Array.isArray(options));
};
exports.isValidOptionsType = isValidOptionsType;
const extractHostnameAndPort = (requestOptions) => {
    var _a;
    if (requestOptions.hostname && requestOptions.port) {
        return { hostname: requestOptions.hostname, port: requestOptions.port };
    }
    const matches = ((_a = requestOptions.host) === null || _a === void 0 ? void 0 : _a.match(/^([^:/ ]+)(:\d{1,5})?/)) || null;
    const hostname = requestOptions.hostname || (matches === null ? 'localhost' : matches[1]);
    let port = requestOptions.port;
    if (!port) {
        if (matches && matches[2]) {
            // remove the leading ":". The extracted port would be something like ":8080"
            port = matches[2].substring(1);
        }
        else {
            port = requestOptions.protocol === 'https:' ? '443' : '80';
        }
    }
    return { hostname, port };
};
exports.extractHostnameAndPort = extractHostnameAndPort;
/**
 * Returns outgoing request attributes scoped to the options passed to the request
 * @param {ParsedRequestOptions} requestOptions the same options used to make the request
 * @param {{ component: string, hostname: string, hookAttributes?: Attributes }} options used to pass data needed to create attributes
 * @param {SemconvStability} semconvStability determines which semconv version to use
 */
const getOutgoingRequestAttributes = (requestOptions, options, semconvStability) => {
    var _a, _b;
    const hostname = options.hostname;
    const port = options.port;
    const method = (_a = requestOptions.method) !== null && _a !== void 0 ? _a : 'GET';
    const normalizedMethod = normalizeMethod(method);
    const headers = requestOptions.headers || {};
    const userAgent = headers['user-agent'];
    const urlFull = (0, exports.getAbsoluteUrl)(requestOptions, headers, `${options.component}:`);
    const oldAttributes = {
        [semantic_conventions_1.SEMATTRS_HTTP_URL]: urlFull,
        [semantic_conventions_1.SEMATTRS_HTTP_METHOD]: method,
        [semantic_conventions_1.SEMATTRS_HTTP_TARGET]: requestOptions.path || '/',
        [semantic_conventions_1.SEMATTRS_NET_PEER_NAME]: hostname,
        [semantic_conventions_1.SEMATTRS_HTTP_HOST]: (_b = headers.host) !== null && _b !== void 0 ? _b : `${hostname}:${port}`,
    };
    const newAttributes = {
        // Required attributes
        [semantic_conventions_1.ATTR_HTTP_REQUEST_METHOD]: normalizedMethod,
        [semantic_conventions_1.ATTR_SERVER_ADDRESS]: hostname,
        [semantic_conventions_1.ATTR_SERVER_PORT]: Number(port),
        [semantic_conventions_1.ATTR_URL_FULL]: urlFull,
        // leaving out protocol version, it is not yet negotiated
        // leaving out protocol name, it is only required when protocol version is set
        // retries and redirects not supported
        // Opt-in attributes left off for now
    };
    // conditionally required if request method required case normalization
    if (method !== normalizedMethod) {
        newAttributes[semantic_conventions_1.ATTR_HTTP_REQUEST_METHOD_ORIGINAL] = method;
    }
    if (userAgent !== undefined) {
        oldAttributes[semantic_conventions_1.SEMATTRS_HTTP_USER_AGENT] = userAgent;
    }
    switch (semconvStability) {
        case 1 /* STABLE */:
            return Object.assign(newAttributes, options.hookAttributes);
        case 2 /* OLD */:
            return Object.assign(oldAttributes, options.hookAttributes);
    }
    return Object.assign(oldAttributes, newAttributes, options.hookAttributes);
};
exports.getOutgoingRequestAttributes = getOutgoingRequestAttributes;
/**
 * Returns outgoing request Metric attributes scoped to the request data
 * @param {Attributes} spanAttributes the span attributes
 */
const getOutgoingRequestMetricAttributes = (spanAttributes) => {
    const metricAttributes = {};
    metricAttributes[semantic_conventions_1.SEMATTRS_HTTP_METHOD] = spanAttributes[semantic_conventions_1.SEMATTRS_HTTP_METHOD];
    metricAttributes[semantic_conventions_1.SEMATTRS_NET_PEER_NAME] =
        spanAttributes[semantic_conventions_1.SEMATTRS_NET_PEER_NAME];
    //TODO: http.url attribute, it should substitute any parameters to avoid high cardinality.
    return metricAttributes;
};
exports.getOutgoingRequestMetricAttributes = getOutgoingRequestMetricAttributes;
/**
 * Returns attributes related to the kind of HTTP protocol used
 * @param {string} [kind] Kind of HTTP protocol used: "1.0", "1.1", "2", "SPDY" or "QUIC".
 */
const setAttributesFromHttpKind = (kind, attributes) => {
    if (kind) {
        attributes[semantic_conventions_1.SEMATTRS_HTTP_FLAVOR] = kind;
        if (kind.toUpperCase() !== 'QUIC') {
            attributes[semantic_conventions_1.SEMATTRS_NET_TRANSPORT] = semantic_conventions_1.NETTRANSPORTVALUES_IP_TCP;
        }
        else {
            attributes[semantic_conventions_1.SEMATTRS_NET_TRANSPORT] = semantic_conventions_1.NETTRANSPORTVALUES_IP_UDP;
        }
    }
};
exports.setAttributesFromHttpKind = setAttributesFromHttpKind;
/**
 * Returns outgoing request attributes scoped to the response data
 * @param {IncomingMessage} response the response object
 * @param {SemconvStability} semconvStability determines which semconv version to use
 */
const getOutgoingRequestAttributesOnResponse = (response, semconvStability) => {
    const { statusCode, statusMessage, httpVersion, socket } = response;
    const oldAttributes = {};
    const stableAttributes = {};
    if (statusCode != null) {
        stableAttributes[semantic_conventions_1.ATTR_HTTP_RESPONSE_STATUS_CODE] = statusCode;
    }
    if (socket) {
        const { remoteAddress, remotePort } = socket;
        oldAttributes[semantic_conventions_1.SEMATTRS_NET_PEER_IP] = remoteAddress;
        oldAttributes[semantic_conventions_1.SEMATTRS_NET_PEER_PORT] = remotePort;
        // Recommended
        stableAttributes[semantic_conventions_1.ATTR_NETWORK_PEER_ADDRESS] = remoteAddress;
        stableAttributes[semantic_conventions_1.ATTR_NETWORK_PEER_PORT] = remotePort;
        stableAttributes[semantic_conventions_1.ATTR_NETWORK_PROTOCOL_VERSION] = response.httpVersion;
    }
    (0, exports.setResponseContentLengthAttribute)(response, oldAttributes);
    if (statusCode) {
        oldAttributes[semantic_conventions_1.SEMATTRS_HTTP_STATUS_CODE] = statusCode;
        oldAttributes[AttributeNames_1.AttributeNames.HTTP_STATUS_TEXT] = (statusMessage || '').toUpperCase();
    }
    (0, exports.setAttributesFromHttpKind)(httpVersion, oldAttributes);
    switch (semconvStability) {
        case 1 /* STABLE */:
            return stableAttributes;
        case 2 /* OLD */:
            return oldAttributes;
    }
    return Object.assign(oldAttributes, stableAttributes);
};
exports.getOutgoingRequestAttributesOnResponse = getOutgoingRequestAttributesOnResponse;
/**
 * Returns outgoing request Metric attributes scoped to the response data
 * @param {Attributes} spanAttributes the span attributes
 */
const getOutgoingRequestMetricAttributesOnResponse = (spanAttributes) => {
    const metricAttributes = {};
    metricAttributes[semantic_conventions_1.SEMATTRS_NET_PEER_PORT] =
        spanAttributes[semantic_conventions_1.SEMATTRS_NET_PEER_PORT];
    metricAttributes[semantic_conventions_1.SEMATTRS_HTTP_STATUS_CODE] =
        spanAttributes[semantic_conventions_1.SEMATTRS_HTTP_STATUS_CODE];
    metricAttributes[semantic_conventions_1.SEMATTRS_HTTP_FLAVOR] = spanAttributes[semantic_conventions_1.SEMATTRS_HTTP_FLAVOR];
    return metricAttributes;
};
exports.getOutgoingRequestMetricAttributesOnResponse = getOutgoingRequestMetricAttributesOnResponse;
function parseHostHeader(hostHeader, proto) {
    const parts = hostHeader.split(':');
    // no semicolon implies ipv4 dotted syntax or host name without port
    // x.x.x.x
    // example.com
    if (parts.length === 1) {
        if (proto === 'http') {
            return { host: parts[0], port: '80' };
        }
        if (proto === 'https') {
            return { host: parts[0], port: '443' };
        }
        return { host: parts[0] };
    }
    // single semicolon implies ipv4 dotted syntax or host name with port
    // x.x.x.x:yyyy
    // example.com:yyyy
    if (parts.length === 2) {
        return {
            host: parts[0],
            port: parts[1],
        };
    }
    // more than 2 parts implies ipv6 syntax with multiple colons
    // [x:x:x:x:x:x:x:x]
    // [x:x:x:x:x:x:x:x]:yyyy
    if (parts[0].startsWith('[')) {
        if (parts[parts.length - 1].endsWith(']')) {
            if (proto === 'http') {
                return { host: hostHeader, port: '80' };
            }
            if (proto === 'https') {
                return { host: hostHeader, port: '443' };
            }
        }
        else if (parts[parts.length - 2].endsWith(']')) {
            return {
                host: parts.slice(0, -1).join(':'),
                port: parts[parts.length - 1],
            };
        }
    }
    // if nothing above matches just return the host header
    return { host: hostHeader };
}
/**
 * Get server.address and port according to http semconv 1.27
 * https://github.com/open-telemetry/semantic-conventions/blob/bf0a2c1134f206f034408b201dbec37960ed60ec/docs/http/http-spans.md#setting-serveraddress-and-serverport-attributes
 */
function getServerAddress(request, component) {
    const forwardedHeader = request.headers['forwarded'];
    if (forwardedHeader) {
        for (const entry of parseForwardedHeader(forwardedHeader)) {
            if (entry.host) {
                return parseHostHeader(entry.host, entry.proto);
            }
        }
    }
    const xForwardedHost = request.headers['x-forwarded-host'];
    if (typeof xForwardedHost === 'string') {
        if (typeof request.headers['x-forwarded-proto'] === 'string') {
            return parseHostHeader(xForwardedHost, request.headers['x-forwarded-proto']);
        }
        if (Array.isArray(request.headers['x-forwarded-proto'])) {
            return parseHostHeader(xForwardedHost, request.headers['x-forwarded-proto'][0]);
        }
        return parseHostHeader(xForwardedHost);
    }
    else if (Array.isArray(xForwardedHost) &&
        typeof xForwardedHost[0] === 'string' &&
        xForwardedHost[0].length > 0) {
        if (typeof request.headers['x-forwarded-proto'] === 'string') {
            return parseHostHeader(xForwardedHost[0], request.headers['x-forwarded-proto']);
        }
        if (Array.isArray(request.headers['x-forwarded-proto'])) {
            return parseHostHeader(xForwardedHost[0], request.headers['x-forwarded-proto'][0]);
        }
        return parseHostHeader(xForwardedHost[0]);
    }
    const host = request.headers['host'];
    if (typeof host === 'string' && host.length > 0) {
        return parseHostHeader(host, component);
    }
    return null;
}
/**
 * Get server.address and port according to http semconv 1.27
 * https://github.com/open-telemetry/semantic-conventions/blob/bf0a2c1134f206f034408b201dbec37960ed60ec/docs/http/http-spans.md#setting-serveraddress-and-serverport-attributes
 */
function getRemoteClientAddress(request) {
    const forwardedHeader = request.headers['forwarded'];
    if (forwardedHeader) {
        for (const entry of parseForwardedHeader(forwardedHeader)) {
            if (entry.for) {
                return entry.for;
            }
        }
    }
    const xForwardedFor = request.headers['x-forwarded-for'];
    if (typeof xForwardedFor === 'string') {
        return xForwardedFor;
    }
    else if (Array.isArray(xForwardedFor)) {
        return xForwardedFor[0];
    }
    const remote = request.socket.remoteAddress;
    if (remote) {
        return remote;
    }
    return null;
}
exports.getRemoteClientAddress = getRemoteClientAddress;
function getInfoFromIncomingMessage(component, request, logger) {
    var _a, _b;
    try {
        if (request.headers.host) {
            return new URL((_a = request.url) !== null && _a !== void 0 ? _a : '/', `${component}://${request.headers.host}`);
        }
        else {
            const unsafeParsedUrl = new URL((_b = request.url) !== null && _b !== void 0 ? _b : '/', 
            // using localhost as a workaround to still use the URL constructor for parsing
            `${component}://localhost`);
            // since we use localhost as a workaround, ensure we hide the rest of the properties to avoid
            // our workaround leaking though.
            return {
                pathname: unsafeParsedUrl.pathname,
                search: unsafeParsedUrl.search,
                toString: function () {
                    // we cannot use the result of unsafeParsedUrl.toString as it's potentially wrong.
                    return unsafeParsedUrl.pathname + unsafeParsedUrl.search;
                },
            };
        }
    }
    catch (e) {
        // something is wrong, use undefined - this *should* never happen, logging
        // for troubleshooting in case it does happen.
        logger.verbose('Unable to get URL from request', e);
        return {};
    }
}
/**
 * Returns incoming request attributes scoped to the request data
 * @param {IncomingMessage} request the request object
 * @param {{ component: string, serverName?: string, hookAttributes?: Attributes }} options used to pass data needed to create attributes
 * @param {SemconvStability} semconvStability determines which semconv version to use
 */
const getIncomingRequestAttributes = (request, options, logger) => {
    const headers = request.headers;
    const userAgent = headers['user-agent'];
    const ips = headers['x-forwarded-for'];
    const httpVersion = request.httpVersion;
    const host = headers.host;
    const hostname = (host === null || host === void 0 ? void 0 : host.replace(/^(.*)(:[0-9]{1,5})/, '$1')) || 'localhost';
    const method = request.method;
    const normalizedMethod = normalizeMethod(method);
    const serverAddress = getServerAddress(request, options.component);
    const serverName = options.serverName;
    const remoteClientAddress = getRemoteClientAddress(request);
    const newAttributes = {
        [semantic_conventions_1.ATTR_HTTP_REQUEST_METHOD]: normalizedMethod,
        [semantic_conventions_1.ATTR_URL_SCHEME]: options.component,
        [semantic_conventions_1.ATTR_SERVER_ADDRESS]: serverAddress === null || serverAddress === void 0 ? void 0 : serverAddress.host,
        [semantic_conventions_1.ATTR_NETWORK_PEER_ADDRESS]: request.socket.remoteAddress,
        [semantic_conventions_1.ATTR_NETWORK_PEER_PORT]: request.socket.remotePort,
        [semantic_conventions_1.ATTR_NETWORK_PROTOCOL_VERSION]: request.httpVersion,
        [semantic_conventions_1.ATTR_USER_AGENT_ORIGINAL]: userAgent,
    };
    const parsedUrl = getInfoFromIncomingMessage(options.component, request, logger);
    if ((parsedUrl === null || parsedUrl === void 0 ? void 0 : parsedUrl.pathname) != null) {
        newAttributes[semantic_conventions_1.ATTR_URL_PATH] = parsedUrl.pathname;
    }
    if (remoteClientAddress != null) {
        newAttributes[semantic_conventions_1.ATTR_CLIENT_ADDRESS] = remoteClientAddress;
    }
    if ((serverAddress === null || serverAddress === void 0 ? void 0 : serverAddress.port) != null) {
        newAttributes[semantic_conventions_1.ATTR_SERVER_PORT] = Number(serverAddress.port);
    }
    // conditionally required if request method required case normalization
    if (method !== normalizedMethod) {
        newAttributes[semantic_conventions_1.ATTR_HTTP_REQUEST_METHOD_ORIGINAL] = method;
    }
    const oldAttributes = {
        [semantic_conventions_1.SEMATTRS_HTTP_URL]: parsedUrl.toString(),
        [semantic_conventions_1.SEMATTRS_HTTP_HOST]: host,
        [semantic_conventions_1.SEMATTRS_NET_HOST_NAME]: hostname,
        [semantic_conventions_1.SEMATTRS_HTTP_METHOD]: method,
        [semantic_conventions_1.SEMATTRS_HTTP_SCHEME]: options.component,
    };
    if (typeof ips === 'string') {
        oldAttributes[semantic_conventions_1.SEMATTRS_HTTP_CLIENT_IP] = ips.split(',')[0];
    }
    if (typeof serverName === 'string') {
        oldAttributes[semantic_conventions_1.SEMATTRS_HTTP_SERVER_NAME] = serverName;
    }
    if (parsedUrl === null || parsedUrl === void 0 ? void 0 : parsedUrl.pathname) {
        oldAttributes[semantic_conventions_1.SEMATTRS_HTTP_TARGET] =
            (parsedUrl === null || parsedUrl === void 0 ? void 0 : parsedUrl.pathname) + (parsedUrl === null || parsedUrl === void 0 ? void 0 : parsedUrl.search) || '/';
    }
    if (userAgent !== undefined) {
        oldAttributes[semantic_conventions_1.SEMATTRS_HTTP_USER_AGENT] = userAgent;
    }
    (0, exports.setRequestContentLengthAttribute)(request, oldAttributes);
    (0, exports.setAttributesFromHttpKind)(httpVersion, oldAttributes);
    switch (options.semconvStability) {
        case 1 /* STABLE */:
            return Object.assign(newAttributes, options.hookAttributes);
        case 2 /* OLD */:
            return Object.assign(oldAttributes, options.hookAttributes);
    }
    return Object.assign(oldAttributes, newAttributes, options.hookAttributes);
};
exports.getIncomingRequestAttributes = getIncomingRequestAttributes;
/**
 * Returns incoming request Metric attributes scoped to the request data
 * @param {Attributes} spanAttributes the span attributes
 * @param {{ component: string }} options used to pass data needed to create attributes
 */
const getIncomingRequestMetricAttributes = (spanAttributes) => {
    const metricAttributes = {};
    metricAttributes[semantic_conventions_1.SEMATTRS_HTTP_SCHEME] = spanAttributes[semantic_conventions_1.SEMATTRS_HTTP_SCHEME];
    metricAttributes[semantic_conventions_1.SEMATTRS_HTTP_METHOD] = spanAttributes[semantic_conventions_1.SEMATTRS_HTTP_METHOD];
    metricAttributes[semantic_conventions_1.SEMATTRS_NET_HOST_NAME] =
        spanAttributes[semantic_conventions_1.SEMATTRS_NET_HOST_NAME];
    metricAttributes[semantic_conventions_1.SEMATTRS_HTTP_FLAVOR] = spanAttributes[semantic_conventions_1.SEMATTRS_HTTP_FLAVOR];
    //TODO: http.target attribute, it should substitute any parameters to avoid high cardinality.
    return metricAttributes;
};
exports.getIncomingRequestMetricAttributes = getIncomingRequestMetricAttributes;
/**
 * Returns incoming request attributes scoped to the response data
 * @param {(ServerResponse & { socket: Socket; })} response the response object
 */
const getIncomingRequestAttributesOnResponse = (request, response, semconvStability) => {
    // take socket from the request,
    // since it may be detached from the response object in keep-alive mode
    const { socket } = request;
    const { statusCode, statusMessage } = response;
    const newAttributes = {
        [semantic_conventions_1.ATTR_HTTP_RESPONSE_STATUS_CODE]: statusCode,
    };
    const rpcMetadata = (0, core_1.getRPCMetadata)(api_1.context.active());
    const oldAttributes = {};
    if (socket) {
        const { localAddress, localPort, remoteAddress, remotePort } = socket;
        oldAttributes[semantic_conventions_1.SEMATTRS_NET_HOST_IP] = localAddress;
        oldAttributes[semantic_conventions_1.SEMATTRS_NET_HOST_PORT] = localPort;
        oldAttributes[semantic_conventions_1.SEMATTRS_NET_PEER_IP] = remoteAddress;
        oldAttributes[semantic_conventions_1.SEMATTRS_NET_PEER_PORT] = remotePort;
    }
    oldAttributes[semantic_conventions_1.SEMATTRS_HTTP_STATUS_CODE] = statusCode;
    oldAttributes[AttributeNames_1.AttributeNames.HTTP_STATUS_TEXT] = (statusMessage || '').toUpperCase();
    if ((rpcMetadata === null || rpcMetadata === void 0 ? void 0 : rpcMetadata.type) === core_1.RPCType.HTTP && rpcMetadata.route !== undefined) {
        oldAttributes[semantic_conventions_1.SEMATTRS_HTTP_ROUTE] = rpcMetadata.route;
        newAttributes[semantic_conventions_1.ATTR_HTTP_ROUTE] = rpcMetadata.route;
    }
    switch (semconvStability) {
        case 1 /* STABLE */:
            return newAttributes;
        case 2 /* OLD */:
            return oldAttributes;
    }
    return Object.assign(oldAttributes, newAttributes);
};
exports.getIncomingRequestAttributesOnResponse = getIncomingRequestAttributesOnResponse;
/**
 * Returns incoming request Metric attributes scoped to the request data
 * @param {Attributes} spanAttributes the span attributes
 */
const getIncomingRequestMetricAttributesOnResponse = (spanAttributes) => {
    const metricAttributes = {};
    metricAttributes[semantic_conventions_1.SEMATTRS_HTTP_STATUS_CODE] =
        spanAttributes[semantic_conventions_1.SEMATTRS_HTTP_STATUS_CODE];
    metricAttributes[semantic_conventions_1.SEMATTRS_NET_HOST_PORT] =
        spanAttributes[semantic_conventions_1.SEMATTRS_NET_HOST_PORT];
    if (spanAttributes[semantic_conventions_1.SEMATTRS_HTTP_ROUTE] !== undefined) {
        metricAttributes[semantic_conventions_1.SEMATTRS_HTTP_ROUTE] = spanAttributes[semantic_conventions_1.SEMATTRS_HTTP_ROUTE];
    }
    return metricAttributes;
};
exports.getIncomingRequestMetricAttributesOnResponse = getIncomingRequestMetricAttributesOnResponse;
const getIncomingStableRequestMetricAttributesOnResponse = (spanAttributes) => {
    const metricAttributes = {};
    if (spanAttributes[semantic_conventions_1.ATTR_HTTP_ROUTE] !== undefined) {
        metricAttributes[semantic_conventions_1.ATTR_HTTP_ROUTE] = spanAttributes[semantic_conventions_1.SEMATTRS_HTTP_ROUTE];
    }
    // required if and only if one was sent, same as span requirement
    if (spanAttributes[semantic_conventions_1.ATTR_HTTP_RESPONSE_STATUS_CODE]) {
        metricAttributes[semantic_conventions_1.ATTR_HTTP_RESPONSE_STATUS_CODE] =
            spanAttributes[semantic_conventions_1.ATTR_HTTP_RESPONSE_STATUS_CODE];
    }
    return metricAttributes;
};
exports.getIncomingStableRequestMetricAttributesOnResponse = getIncomingStableRequestMetricAttributesOnResponse;
function headerCapture(type, headers) {
    const normalizedHeaders = new Map();
    for (let i = 0, len = headers.length; i < len; i++) {
        const capturedHeader = headers[i].toLowerCase();
        normalizedHeaders.set(capturedHeader, capturedHeader.replace(/-/g, '_'));
    }
    return (span, getHeader) => {
        for (const capturedHeader of normalizedHeaders.keys()) {
            const value = getHeader(capturedHeader);
            if (value === undefined) {
                continue;
            }
            const normalizedHeader = normalizedHeaders.get(capturedHeader);
            const key = `http.${type}.header.${normalizedHeader}`;
            if (typeof value === 'string') {
                span.setAttribute(key, [value]);
            }
            else if (Array.isArray(value)) {
                span.setAttribute(key, value);
            }
            else {
                span.setAttribute(key, [value]);
            }
        }
    };
}
exports.headerCapture = headerCapture;
const KNOWN_METHODS = new Set([
    // methods from https://www.rfc-editor.org/rfc/rfc9110.html#name-methods
    'GET',
    'HEAD',
    'POST',
    'PUT',
    'DELETE',
    'CONNECT',
    'OPTIONS',
    'TRACE',
    // PATCH from https://www.rfc-editor.org/rfc/rfc5789.html
    'PATCH',
]);
function normalizeMethod(method) {
    if (method == null) {
        return 'GET';
    }
    const upper = method.toUpperCase();
    if (KNOWN_METHODS.has(upper)) {
        return upper;
    }
    return '_OTHER';
}
function parseForwardedHeader(header) {
    try {
        return forwardedParse(header);
    }
    catch (_a) {
        return [];
    }
}
//# sourceMappingURL=utils.js.map