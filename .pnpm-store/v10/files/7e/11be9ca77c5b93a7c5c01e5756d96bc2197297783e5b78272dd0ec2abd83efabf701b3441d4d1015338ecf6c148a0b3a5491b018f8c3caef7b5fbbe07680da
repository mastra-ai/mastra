"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpErrorContext = exports.AnalyticsErrorContext = exports.SearchErrorContext = exports.QueryErrorContext = exports.ViewErrorContext = exports.KeyValueErrorContext = exports.ErrorContext = void 0;
/**
 * Generic base class for all known error context types.
 *
 * @category Error Handling
 */
class ErrorContext {
    constructor(data) {
        this.last_dispatched_to = data.last_dispatched_to || '';
        this.last_dispatched_from = data.last_dispatched_from || '';
        this.retry_attempts = data.retry_attempts || 0;
        this.retry_reasons = data.retry_reasons || [];
    }
}
exports.ErrorContext = ErrorContext;
/**
 * The error context information for a key-value operation.
 *
 * @category Error Handling
 */
class KeyValueErrorContext extends ErrorContext {
    /**
     * @internal
     */
    constructor(data) {
        super(data);
        this.status_code = data.status_code;
        this.opaque = data.opaque;
        this.cas = data.cas;
        this.key = data.key;
        this.bucket = data.bucket;
        this.collection = data.collection;
        this.scope = data.scope;
        this.context = data.context;
        this.ref = data.ref;
    }
}
exports.KeyValueErrorContext = KeyValueErrorContext;
/**
 * The error context information for a views operation.
 *
 * @category Error Handling
 */
class ViewErrorContext extends ErrorContext {
    /**
     * @internal
     */
    constructor(data) {
        super(data);
        this.design_document = data.design_document;
        this.view = data.view;
        this.parameters = data.parameters;
        this.http_response_code = data.http_response_code;
        this.http_response_body = data.http_response_body;
    }
}
exports.ViewErrorContext = ViewErrorContext;
/**
 * The error context information for a query operation.
 *
 * @category Error Handling
 */
class QueryErrorContext extends ErrorContext {
    /**
     * @internal
     */
    constructor(data) {
        super(data);
        this.statement = data.statement;
        this.client_context_id = data.client_context_id;
        this.parameters = data.parameters;
        this.http_response_code = data.http_response_code;
        this.http_response_body = data.http_response_body;
    }
}
exports.QueryErrorContext = QueryErrorContext;
/**
 * The error context information for a search query operation.
 *
 * @category Error Handling
 */
class SearchErrorContext extends ErrorContext {
    /**
     * @internal
     */
    constructor(data) {
        super(data);
        this.index_name = data.index_name;
        this.query = data.query;
        this.parameters = data.parameters;
        this.http_response_code = data.http_response_code;
        this.http_response_body = data.http_response_body;
    }
}
exports.SearchErrorContext = SearchErrorContext;
/**
 * The error context information for an analytics query operation.
 *
 * @category Error Handling
 */
class AnalyticsErrorContext extends ErrorContext {
    /**
     * @internal
     */
    constructor(data) {
        super(data);
        this.statement = data.statement;
        this.client_context_id = data.client_context_id;
        this.parameters = data.parameters;
        this.http_response_code = data.http_response_code;
        this.http_response_body = data.http_response_body;
    }
}
exports.AnalyticsErrorContext = AnalyticsErrorContext;
/**
 * The error context information for a http operation.
 *
 * @category Error Handling
 */
class HttpErrorContext extends ErrorContext {
    /**
     * @internal
     */
    constructor(data) {
        super(data);
        this.method = data.method;
        this.request_path = data.request_path;
        this.response_code = data.response_code;
        this.response_body = data.response_body;
    }
}
exports.HttpErrorContext = HttpErrorContext;
