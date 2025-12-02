/**
 * The name of the connection pool; unique within the instrumented application. In case the connection pool implementation doesn't provide a name, instrumentation **SHOULD** use a combination of parameters that would make the name unique, for example, combining attributes `server.address`, `server.port`, and `db.namespace`, formatted as `server.address:server.port/db.namespace`. Instrumentations that generate connection pool name following different patterns **SHOULD** document it.
 *
 * @example myDataSource
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export declare const ATTR_DB_CLIENT_CONNECTION_POOL_NAME = "db.client.connection.pool.name";
/**
 * The state of a connection in the pool
 *
 * @example idle
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export declare const ATTR_DB_CLIENT_CONNECTION_STATE = "db.client.connection.state";
/**
 * The name of the database, fully qualified within the server address and port.
 *
 * @example customers
 * @example test.users
 *
 * @note If a database system has multiple namespace components, they **SHOULD** be concatenated (potentially using database system specific conventions) from most general to most specific namespace component, and more specific namespaces **SHOULD NOT** be captured without the more general namespaces, to ensure that "startswith" queries for the more general namespaces will be valid.
 * Semantic conventions for individual database systems **SHOULD** document what `db.namespace` means in the context of that system.
 * It is **RECOMMENDED** to capture the value as provided by the application without attempting to do any case normalization.
 * This attribute has stability level RELEASE CANDIDATE.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export declare const ATTR_DB_NAMESPACE = "db.namespace";
/**
 * The name of the operation or command being executed.
 *
 * @example findAndModify
 * @example HMSET
 * @example SELECT
 *
 * @note It is **RECOMMENDED** to capture the value as provided by the application without attempting to do any case normalization.
 * If the operation name is parsed from the query text, it **SHOULD** be the first operation name found in the query.
 * For batch operations, if the individual operations are known to have the same operation name then that operation name **SHOULD** be used prepended by `BATCH `, otherwise `db.operation.name` **SHOULD** be `BATCH` or some other database system specific term if more applicable.
 * This attribute has stability level RELEASE CANDIDATE.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export declare const ATTR_DB_OPERATION_NAME = "db.operation.name";
/**
 * Enum value "used" for attribute {@link ATTR_DB_CLIENT_CONNECTION_STATE}.
 */
export declare const DB_CLIENT_CONNECTION_STATE_VALUE_USED = "used";
/**
 * Enum value "idle" for attribute {@link ATTR_DB_CLIENT_CONNECTION_STATE}.
 */
export declare const DB_CLIENT_CONNECTION_STATE_VALUE_IDLE = "idle";
/**
 * The number of connections that are currently in state described by the `state` attribute
 *
 * @experimental This metric is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export declare const METRIC_DB_CLIENT_CONNECTION_COUNT = "db.client.connection.count";
/**
 * The number of current pending requests for an open connection
 *
 * @experimental This metric is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export declare const METRIC_DB_CLIENT_CONNECTION_PENDING_REQUESTS = "db.client.connection.pending_requests";
/**
 * Duration of database client operations.
 *
 * @note Batch operations **SHOULD** be recorded as a single operation.
 *
 * @experimental This metric is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export declare const METRIC_DB_CLIENT_OPERATION_DURATION = "db.client.operation.duration";
//# sourceMappingURL=semconv.d.ts.map