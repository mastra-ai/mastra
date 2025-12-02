"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticAttributes = void 0;
// DO NOT EDIT, this is an Auto-generated file from scripts/semconv/templates//templates/SemanticAttributes.ts.j2
exports.SemanticAttributes = {
    /**
     * State of the HTTP connection in the HTTP connection pool.
     */
    HTTP_CONNECTION_STATE: 'http.connection.state',
    /**
    * Describes a class of error the operation ended with.
    *
    * Note: The `error.type` SHOULD be predictable and SHOULD have low cardinality.
  Instrumentations SHOULD document the list of errors they report.
  
  The cardinality of `error.type` within one instrumentation library SHOULD be low.
  Telemetry consumers that aggregate data from multiple instrumentation libraries and applications
  should be prepared for `error.type` to have high cardinality at query time when no
  additional filters are applied.
  
  If the operation has completed successfully, instrumentations SHOULD NOT set `error.type`.
  
  If a specific domain defines its own set of error identifiers (such as HTTP or gRPC status codes),
  it&#39;s RECOMMENDED to:
  
  * Use a domain-specific attribute
  * Set `error.type` to capture all errors, regardless of whether they are defined within the domain-specific set or not.
    */
    ERROR_TYPE: 'error.type',
    /**
     * The size of the request payload body in bytes. This is the number of bytes transferred excluding headers and is often, but not always, present as the [Content-Length](https://www.rfc-editor.org/rfc/rfc9110.html#field.content-length) header. For requests using transport encoding, this should be the compressed size.
     */
    HTTP_REQUEST_BODY_SIZE: 'http.request.body.size',
    /**
    * HTTP request method.
    *
    * Note: HTTP request method value SHOULD be &#34;known&#34; to the instrumentation.
  By default, this convention defines &#34;known&#34; methods as the ones listed in [RFC9110](https://www.rfc-editor.org/rfc/rfc9110.html#name-methods)
  and the PATCH method defined in [RFC5789](https://www.rfc-editor.org/rfc/rfc5789.html).
  
  If the HTTP request method is not known to instrumentation, it MUST set the `http.request.method` attribute to `_OTHER`.
  
  If the HTTP instrumentation could end up converting valid HTTP request methods to `_OTHER`, then it MUST provide a way to override
  the list of known HTTP methods. If this override is done via environment variable, then the environment variable MUST be named
  OTEL_INSTRUMENTATION_HTTP_KNOWN_METHODS and support a comma-separated list of case-sensitive known HTTP methods
  (this list MUST be a full override of the default known method, it is not a list of known methods in addition to the defaults).
  
  HTTP method names are case-sensitive and `http.request.method` attribute value MUST match a known HTTP method name exactly.
  Instrumentations for specific web frameworks that consider HTTP methods to be case insensitive, SHOULD populate a canonical equivalent.
  Tracing instrumentations that do so, MUST also set `http.request.method_original` to the original value.
    */
    HTTP_REQUEST_METHOD: 'http.request.method',
    /**
     * Original HTTP method sent by the client in the request line.
     */
    HTTP_REQUEST_METHOD_ORIGINAL: 'http.request.method_original',
    /**
     * The ordinal number of request resending attempt (for any reason, including redirects).
     *
     * Note: The resend count SHOULD be updated each time an HTTP request gets resent by the client, regardless of what was the cause of the resending (e.g. redirection, authorization failure, 503 Server Unavailable, network issues, or any other).
     */
    HTTP_REQUEST_RESEND_COUNT: 'http.request.resend_count',
    /**
     * The size of the response payload body in bytes. This is the number of bytes transferred excluding headers and is often, but not always, present as the [Content-Length](https://www.rfc-editor.org/rfc/rfc9110.html#field.content-length) header. For requests using transport encoding, this should be the compressed size.
     */
    HTTP_RESPONSE_BODY_SIZE: 'http.response.body.size',
    /**
     * [HTTP response status code](https://tools.ietf.org/html/rfc7231#section-6).
     */
    HTTP_RESPONSE_STATUS_CODE: 'http.response.status_code',
    /**
    * The matched route, that is, the path template in the format used by the respective server framework.
    *
    * Note: MUST NOT be populated when this is not supported by the HTTP server framework as the route attribute should have low-cardinality and the URI path can NOT substitute it.
  SHOULD include the [application root](/docs/http/http-spans.md#http-server-definitions) if there is one.
    */
    HTTP_ROUTE: 'http.route',
    /**
     * Peer address of the network connection - IP address or Unix domain socket name.
     */
    NETWORK_PEER_ADDRESS: 'network.peer.address',
    /**
     * Peer port number of the network connection.
     */
    NETWORK_PEER_PORT: 'network.peer.port',
    /**
     * [OSI application layer](https://osi-model.com/application-layer/) or non-OSI equivalent.
     *
     * Note: The value SHOULD be normalized to lowercase.
     */
    NETWORK_PROTOCOL_NAME: 'network.protocol.name',
    /**
     * Version of the protocol specified in `network.protocol.name`.
     *
     * Note: `network.protocol.version` refers to the version of the protocol used and might be different from the protocol client&#39;s version. If the HTTP client has a version of `0.27.2`, but sends HTTP version `1.1`, this attribute should be set to `1.1`.
     */
    NETWORK_PROTOCOL_VERSION: 'network.protocol.version',
    /**
     * Server domain name if available without reverse DNS lookup; otherwise, IP address or Unix domain socket name.
     *
     * Note: When observed from the client side, and when communicating through an intermediary, `server.address` SHOULD represent the server address behind any intermediaries, for example proxies, if it&#39;s available.
     */
    SERVER_ADDRESS: 'server.address',
    /**
     * Server port number.
     *
     * Note: When observed from the client side, and when communicating through an intermediary, `server.port` SHOULD represent the server port behind any intermediaries, for example proxies, if it&#39;s available.
     */
    SERVER_PORT: 'server.port',
    /**
    * Absolute URL describing a network resource according to [RFC3986](https://www.rfc-editor.org/rfc/rfc3986).
    *
    * Note: For network calls, URL usually has `scheme://host[:port][path][?query][#fragment]` format, where the fragment is not transmitted over HTTP, but if it is known, it SHOULD be included nevertheless.
  `url.full` MUST NOT contain credentials passed via URL in form of `https://username:password@www.example.com/`. In such case username and password SHOULD be redacted and attribute&#39;s value SHOULD be `https://REDACTED:REDACTED@www.example.com/`.
  `url.full` SHOULD capture the absolute URL when it is available (or can be reconstructed) and SHOULD NOT be validated or modified except for sanitizing purposes.
    */
    URL_FULL: 'url.full',
    /**
     * The [URI path](https://www.rfc-editor.org/rfc/rfc3986#section-3.3) component.
     */
    URL_PATH: 'url.path',
    /**
     * The [URI query](https://www.rfc-editor.org/rfc/rfc3986#section-3.4) component.
     *
     * Note: Sensitive content provided in query string SHOULD be scrubbed when instrumentations can identify it.
     */
    URL_QUERY: 'url.query',
    /**
     * The [URI scheme](https://www.rfc-editor.org/rfc/rfc3986#section-3.1) component identifying the used protocol.
     */
    URL_SCHEME: 'url.scheme',
    /**
     * Value of the [HTTP User-Agent](https://www.rfc-editor.org/rfc/rfc9110.html#field.user-agent) header sent by the client.
     */
    USER_AGENT_ORIGINAL: 'user_agent.original',
};
//# sourceMappingURL=SemanticAttributes.js.map