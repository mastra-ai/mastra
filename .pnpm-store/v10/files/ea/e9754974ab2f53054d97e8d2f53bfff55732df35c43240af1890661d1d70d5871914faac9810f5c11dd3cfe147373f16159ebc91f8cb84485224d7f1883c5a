import { Attributes } from '@opentelemetry/api';
import type { ConnectionConfig, PoolActualConfig, Query, QueryOptions } from 'mysql';
import type * as mysqlTypes from 'mysql';
/**
 * Get an Attributes map from a mysql connection config object
 *
 * @param config ConnectionConfig
 */
export declare function getConnectionAttributes(config: ConnectionConfig | PoolActualConfig): Attributes;
/**
 * @returns the database statement being executed.
 */
export declare function getDbStatement(query: string | Query | QueryOptions): string;
export declare function getDbValues(query: string | Query | QueryOptions, values?: any[]): string;
/**
 * The span name SHOULD be set to a low cardinality value
 * representing the statement executed on the database.
 *
 * @returns SQL statement without variable arguments or SQL verb
 */
export declare function getSpanName(query: string | Query | QueryOptions): string;
export declare function arrayStringifyHelper(arr: Array<unknown> | undefined): string;
export declare function getPoolName(pool: mysqlTypes.Pool): string;
//# sourceMappingURL=utils.d.ts.map