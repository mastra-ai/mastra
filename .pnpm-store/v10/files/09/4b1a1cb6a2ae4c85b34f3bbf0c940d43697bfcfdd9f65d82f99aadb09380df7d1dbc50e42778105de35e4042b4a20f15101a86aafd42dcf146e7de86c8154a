export declare const SemanticAttributes: {
    /**
     * State of the HTTP connection in the HTTP connection pool.
     */
    HTTP_CONNECTION_STATE: string;
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
    ERROR_TYPE: string;
    /**
     * The size of the request payload body in bytes. This is the number of bytes transferred excluding headers and is often, but not always, present as the [Content-Length](https://www.rfc-editor.org/rfc/rfc9110.html#field.content-length) header. For requests using transport encoding, this should be the compressed size.
     */
    HTTP_REQUEST_BODY_SIZE: string;
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
    HTTP_REQUEST_METHOD: string;
    /**
     * Original HTTP method sent by the client in the request line.
     */
    HTTP_REQUEST_METHOD_ORIGINAL: string;
    /**
     * The ordinal number of request resending attempt (for any reason, including redirects).
     *
     * Note: The resend count SHOULD be updated each time an HTTP request gets resent by the client, regardless of what was the cause of the resending (e.g. redirection, authorization failure, 503 Server Unavailable, network issues, or any other).
     */
    HTTP_REQUEST_RESEND_COUNT: string;
    /**
     * The size of the response payload body in bytes. This is the number of bytes transferred excluding headers and is often, but not always, present as the [Content-Length](https://www.rfc-editor.org/rfc/rfc9110.html#field.content-length) header. For requests using transport encoding, this should be the compressed size.
     */
    HTTP_RESPONSE_BODY_SIZE: string;
    /**
     * [HTTP response status code](https://tools.ietf.org/html/rfc7231#section-6).
     */
    HTTP_RESPONSE_STATUS_CODE: string;
    /**
    * The matched route, that is, the path template in the format used by the respective server framework.
    *
    * Note: MUST NOT be populated when this is not supported by the HTTP server framework as the route attribute should have low-cardinality and the URI path can NOT substitute it.
  SHOULD include the [application root](/docs/http/http-spans.md#http-server-definitions) if there is one.
    */
    HTTP_ROUTE: string;
    /**
     * Peer address of the network connection - IP address or Unix domain socket name.
     */
    NETWORK_PEER_ADDRESS: string;
    /**
     * Peer port number of the network connection.
     */
    NETWORK_PEER_PORT: string;
    /**
     * [OSI application layer](https://osi-model.com/application-layer/) or non-OSI equivalent.
     *
     * Note: The value SHOULD be normalized to lowercase.
     */
    NETWORK_PROTOCOL_NAME: string;
    /**
     * Version of the protocol specified in `network.protocol.name`.
     *
     * Note: `network.protocol.version` refers to the version of the protocol used and might be different from the protocol client&#39;s version. If the HTTP client has a version of `0.27.2`, but sends HTTP version `1.1`, this attribute should be set to `1.1`.
     */
    NETWORK_PROTOCOL_VERSION: string;
    /**
     * Server domain name if available without reverse DNS lookup; otherwise, IP address or Unix domain socket name.
     *
     * Note: When observed from the client side, and when communicating through an intermediary, `server.address` SHOULD represent the server address behind any intermediaries, for example proxies, if it&#39;s available.
     */
    SERVER_ADDRESS: string;
    /**
     * Server port number.
     *
     * Note: When observed from the client side, and when communicating through an intermediary, `server.port` SHOULD represent the server port behind any intermediaries, for example proxies, if it&#39;s available.
     */
    SERVER_PORT: string;
    /**
    * Absolute URL describing a network resource according to [RFC3986](https://www.rfc-editor.org/rfc/rfc3986).
    *
    * Note: For network calls, URL usually has `scheme://host[:port][path][?query][#fragment]` format, where the fragment is not transmitted over HTTP, but if it is known, it SHOULD be included nevertheless.
  `url.full` MUST NOT contain credentials passed via URL in form of `https://username:password@www.example.com/`. In such case username and password SHOULD be redacted and attribute&#39;s value SHOULD be `https://REDACTED:REDACTED@www.example.com/`.
  `url.full` SHOULD capture the absolute URL when it is available (or can be reconstructed) and SHOULD NOT be validated or modified except for sanitizing purposes.
    */
    URL_FULL: string;
    /**
     * The [URI path](https://www.rfc-editor.org/rfc/rfc3986#section-3.3) component.
     */
    URL_PATH: string;
    /**
     * The [URI query](https://www.rfc-editor.org/rfc/rfc3986#section-3.4) component.
     *
     * Note: Sensitive content provided in query string SHOULD be scrubbed when instrumentations can identify it.
     */
    URL_QUERY: string;
    /**
     * The [URI scheme](https://www.rfc-editor.org/rfc/rfc3986#section-3.1) component identifying the used protocol.
     */
    URL_SCHEME: string;
    /**
     * Value of the [HTTP User-Agent](https://www.rfc-editor.org/rfc/rfc9110.html#field.user-agent) header sent by the client.
     */
    USER_AGENT_ORIGINAL: string;
};
//# sourceMappingURL=SemanticAttributes.d.ts.map