import { Span, Tracer, UpDownCounter, Attributes } from '@opentelemetry/api';
import { PgClientExtended, PostgresCallback, PgPoolCallback, PgPoolExtended, PgParsedConnectionParams, PgPoolOptionsParams } from './internal-types';
import { PgInstrumentationConfig } from './types';
import type * as pgTypes from 'pg';
/**
 * Helper function to get a low cardinality span name from whatever info we have
 * about the query.
 *
 * This is tricky, because we don't have most of the information (table name,
 * operation name, etc) the spec recommends using to build a low-cardinality
 * value w/o parsing. So, we use db.name and assume that, if the query's a named
 * prepared statement, those `name` values will be low cardinality. If we don't
 * have a named prepared statement, we try to parse an operation (despite the
 * spec's warnings).
 *
 * @params dbName The name of the db against which this query is being issued,
 *   which could be missing if no db name was given at the time that the
 *   connection was established.
 * @params queryConfig Information we have about the query being issued, typed
 *   to reflect only the validation we've actually done on the args to
 *   `client.query()`. This will be undefined if `client.query()` was called
 *   with invalid arguments.
 */
export declare function getQuerySpanName(dbName: string | undefined, queryConfig?: {
    text: string;
    name?: unknown;
}): string;
export declare function parseNormalizedOperationName(queryText: string): string;
export declare function getConnectionString(params: PgParsedConnectionParams): string;
export declare function getSemanticAttributesFromConnection(params: PgParsedConnectionParams): {
    "db.system": string;
    "db.name": string | undefined;
    "db.connection_string": string;
    "net.peer.name": string | undefined;
    "net.peer.port": number | undefined;
    "db.user": string | undefined;
};
export declare function getSemanticAttributesFromPool(params: PgPoolOptionsParams): {
    "db.system": string;
    "db.name": string;
    "db.connection_string": string;
    "net.peer.name": string;
    "net.peer.port": number | undefined;
    "db.user": string;
    "db.postgresql.idle.timeout.millis": number;
    "db.postgresql.max.client": number;
};
export declare function shouldSkipInstrumentation(instrumentationConfig: PgInstrumentationConfig): boolean;
export declare function handleConfigQuery(this: PgClientExtended, tracer: Tracer, instrumentationConfig: PgInstrumentationConfig, queryConfig?: {
    text: string;
    values?: unknown;
    name?: unknown;
}): Span;
export declare function handleExecutionResult(config: PgInstrumentationConfig, span: Span, pgResult: pgTypes.QueryResult | pgTypes.QueryArrayResult | unknown): void;
export declare function patchCallback(instrumentationConfig: PgInstrumentationConfig, span: Span, cb: PostgresCallback, attributes: Attributes, recordDuration: {
    (): void;
}): PostgresCallback;
export declare function getPoolName(pool: PgPoolOptionsParams): string;
export interface poolConnectionsCounter {
    used: number;
    idle: number;
    pending: number;
}
export declare function updateCounter(poolName: string, pool: PgPoolExtended, connectionCount: UpDownCounter, connectionPendingRequests: UpDownCounter, latestCounter: poolConnectionsCounter): poolConnectionsCounter;
export declare function patchCallbackPGPool(span: Span, cb: PgPoolCallback): PgPoolCallback;
export declare function patchClientConnectCallback(span: Span, cb: Function): Function;
/**
 * Attempt to get a message string from a thrown value, while being quite
 * defensive, to recognize the fact that, in JS, any kind of value (even
 * primitives) can be thrown.
 */
export declare function getErrorMessage(e: unknown): string | undefined;
export declare function isObjectWithTextString(it: unknown): it is ObjectWithText;
export declare type ObjectWithText = {
    text: string;
    [k: string]: unknown;
};
//# sourceMappingURL=utils.d.ts.map