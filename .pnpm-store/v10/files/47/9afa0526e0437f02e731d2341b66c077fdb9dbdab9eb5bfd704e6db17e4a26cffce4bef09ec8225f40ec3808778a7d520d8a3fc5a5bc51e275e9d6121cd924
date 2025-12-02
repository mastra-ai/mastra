import { ConnectionProvider } from '../driver/connection-provider.js';
import { QueryResult } from '../driver/database-connection.js';
import { CompiledQuery } from '../query-compiler/compiled-query.js';
import { RootOperationNode } from '../query-compiler/query-compiler.js';
import { KyselyPlugin } from '../plugin/kysely-plugin.js';
import { QueryId } from '../util/query-id.js';
import { DialectAdapter } from '../dialect/dialect-adapter.js';
/**
 * This interface abstracts away the details of how to compile a query into SQL
 * and execute it. Instead of passing around all those details, {@link SelectQueryBuilder}
 * and other classes that execute queries can just pass around and instance of
 * `QueryExecutor`.
 */
export interface QueryExecutor extends ConnectionProvider {
    /**
     * Returns the adapter for the current dialect.
     */
    get adapter(): DialectAdapter;
    /**
     * Returns all installed plugins.
     */
    get plugins(): ReadonlyArray<KyselyPlugin>;
    /**
     * Given the query the user has built (expressed as an operation node tree)
     * this method runs it through all plugins' `transformQuery` methods and
     * returns the result.
     */
    transformQuery<T extends RootOperationNode>(node: T, queryId: QueryId): T;
    /**
     * Compiles the transformed query into SQL. You usually want to pass
     * the output of {@link transformQuery} into this method but you can
     * compile any query using this method.
     */
    compileQuery<R = unknown>(node: RootOperationNode, queryId: QueryId): CompiledQuery<R>;
    /**
     * Executes a compiled query and runs the result through all plugins'
     * `transformResult` method.
     */
    executeQuery<R>(compiledQuery: CompiledQuery<R>): Promise<QueryResult<R>>;
    /**
     * Executes a compiled query and runs the result through all plugins'
     * `transformResult` method. Results are streamead instead of loaded
     * at once.
     */
    stream<R>(compiledQuery: CompiledQuery<R>, 
    /**
     * How many rows should be pulled from the database at once. Supported
     * only by the postgres driver.
     */
    chunkSize: number): AsyncIterableIterator<QueryResult<R>>;
    /**
     * Returns a copy of this executor with a new connection provider.
     */
    withConnectionProvider(connectionProvider: ConnectionProvider): QueryExecutor;
    /**
     * Returns a copy of this executor with a plugin added as the
     * last plugin.
     */
    withPlugin(plugin: KyselyPlugin): QueryExecutor;
    /**
     * Returns a copy of this executor with a list of plugins added
     * as the last plugins.
     */
    withPlugins(plugin: ReadonlyArray<KyselyPlugin>): QueryExecutor;
    /**
     * Returns a copy of this executor with a plugin added as the
     * first plugin.
     */
    withPluginAtFront(plugin: KyselyPlugin): QueryExecutor;
    /**
     * Returns a copy of this executor without any plugins.
     */
    withoutPlugins(): QueryExecutor;
}
