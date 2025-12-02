import { Cas } from './utilities';
/**
 * Specific error context types.
 *
 * @category Error Handling
 */
type ErrorContextTypes = KeyValueErrorContext | ViewErrorContext | QueryErrorContext | SearchErrorContext | AnalyticsErrorContext | HttpErrorContext;
/**
 * Generic base class for all known error context types.
 *
 * @category Error Handling
 */
export declare class ErrorContext {
    /**
     * The host and port that the request was last sent to.
     */
    last_dispatched_to: string;
    /**
     * The host and port that the request was last sent from.
     */
    last_dispatched_from: string;
    /**
     * The number of times the operation has been retried.
     */
    retry_attempts: number;
    /**
     * A list of the reasons for retrying the operation.
     */
    retry_reasons: string[];
    constructor(data: ErrorContextTypes);
}
/**
 * The error context information for a key-value operation.
 *
 * @category Error Handling
 */
export declare class KeyValueErrorContext extends ErrorContext {
    /**
     * The memcached status code returned by the server.
     */
    status_code: number;
    /**
     * The opaque identifier for the request.
     */
    opaque: number;
    /**
     * The cas returned by the server.
     */
    cas: Cas;
    /**
     * The key that was being operated on.
     */
    key: string;
    /**
     * The name of the bucket that was being operated on.
     */
    bucket: string;
    /**
     * The name of the collection that was being operated on.
     */
    collection: string;
    /**
     * The name of the scope that was being operated on.
     */
    scope: string;
    /**
     * The context returned by the server helping describing the error.
     */
    context: string;
    /**
     * The reference id returned by the server for correlation in server logs.
     */
    ref: string;
    /**
     * @internal
     */
    constructor(data: KeyValueErrorContext);
}
/**
 * The error context information for a views operation.
 *
 * @category Error Handling
 */
export declare class ViewErrorContext extends ErrorContext {
    /**
     * The name of the design document that was being operated on.
     */
    design_document: string;
    /**
     * The name of the view that was being operated on.
     */
    view: string;
    /**
     * A list of the parameters in use for the operation.
     */
    parameters: any;
    /**
     * The http response status code which was received.
     */
    http_response_code: number;
    /**
     * The http response body which was received.
     */
    http_response_body: string;
    /**
     * @internal
     */
    constructor(data: ViewErrorContext);
}
/**
 * The error context information for a query operation.
 *
 * @category Error Handling
 */
export declare class QueryErrorContext extends ErrorContext {
    /**
     * The statement that was being executed when the error occured.
     */
    statement: string;
    /**
     * The client context id which was sent to the service for correlation
     * between requests and responses.
     */
    client_context_id: string;
    /**
     * A list of the parameters in use for the operation.
     */
    parameters: any;
    /**
     * The http response status code which was received.
     */
    http_response_code: number;
    /**
     * The http response body which was received.
     */
    http_response_body: string;
    /**
     * @internal
     */
    constructor(data: QueryErrorContext);
}
/**
 * The error context information for a search query operation.
 *
 * @category Error Handling
 */
export declare class SearchErrorContext extends ErrorContext {
    /**
     * The name of the index which was being operated on.
     */
    index_name: string;
    /**
     * The full query that was being executed.
     */
    query: any;
    /**
     * A list of the parameters in use for the operation.
     */
    parameters: any;
    /**
     * The http response status code which was received.
     */
    http_response_code: number;
    /**
     * The http response body which was received.
     */
    http_response_body: string;
    /**
     * @internal
     */
    constructor(data: SearchErrorContext);
}
/**
 * The error context information for an analytics query operation.
 *
 * @category Error Handling
 */
export declare class AnalyticsErrorContext extends ErrorContext {
    /**
     * The statement that was being executed when the error occured.
     */
    statement: string;
    /**
     * The client context id which was sent to the service for correlation
     * between requests and responses.
     */
    client_context_id: string;
    /**
     * A list of the parameters in use for the operation.
     */
    parameters: any;
    /**
     * The http response status code which was received.
     */
    http_response_code: number;
    /**
     * The http response body which was received.
     */
    http_response_body: string;
    /**
     * @internal
     */
    constructor(data: QueryErrorContext);
}
/**
 * The error context information for a http operation.
 *
 * @category Error Handling
 */
export declare class HttpErrorContext extends ErrorContext {
    /**
     * The HTTP method of the request that was performed.
     */
    method: string;
    /**
     * The request path for the request that was being performed.
     */
    request_path: string;
    /**
     * The http response status code which was received.
     */
    response_code: number;
    /**
     * The http response body which was received.
     */
    response_body: string;
    /**
     * @internal
     */
    constructor(data: HttpErrorContext);
}
export {};
