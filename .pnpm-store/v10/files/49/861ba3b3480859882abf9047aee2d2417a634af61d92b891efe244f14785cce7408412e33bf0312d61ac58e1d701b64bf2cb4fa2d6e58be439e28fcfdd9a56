import { ConnectionProvider } from '../driver/connection-provider.js';
import { DatabaseConnection, QueryResult } from '../driver/database-connection.js';
import { CompiledQuery } from '../query-compiler/compiled-query.js';
import { RootOperationNode } from '../query-compiler/query-compiler.js';
import { KyselyPlugin } from '../plugin/kysely-plugin.js';
import { QueryId } from '../util/query-id.js';
import { DialectAdapter } from '../dialect/dialect-adapter.js';
import { QueryExecutor } from './query-executor.js';
export declare abstract class QueryExecutorBase implements QueryExecutor {
    #private;
    constructor(plugins?: ReadonlyArray<KyselyPlugin>);
    abstract get adapter(): DialectAdapter;
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
    abstract compileQuery(node: RootOperationNode, queryId: QueryId): CompiledQuery;
    /**
     * Provides a connection for the callback and takes care of disposing
     * the connection after the callback has been run.
     */
    abstract provideConnection<T>(consumer: (connection: DatabaseConnection) => Promise<T>): Promise<T>;
    /**
     * Executes a compiled query and runs the result through all plugins'
     * `transformResult` method.
     */
    executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>>;
    /**
     * Executes a compiled query and runs the result through all plugins'
     * `transformResult` method. Results are streamead instead of loaded
     * at once.
     */
    stream<R>(compiledQuery: CompiledQuery, chunkSize: number): AsyncIterableIterator<QueryResult<R>>;
    /**
     * Returns a copy of this executor with a new connection provider.
     */
    abstract withConnectionProvider(connectionProvider: ConnectionProvider): QueryExecutorBase;
    /**
     * Returns a copy of this executor with a plugin added as the
     * last plugin.
     */
    abstract withPlugin(plugin: KyselyPlugin): QueryExecutorBase;
    /**
     * Returns a copy of this executor with a list of plugins added
     * as the last plugins.
     */
    abstract withPlugins(plugin: ReadonlyArray<KyselyPlugin>): QueryExecutorBase;
    /**
     * Returns a copy of this executor with a plugin added as the
     * first plugin.
     */
    abstract withPluginAtFront(plugin: KyselyPlugin): QueryExecutorBase;
    /**
     * Returns a copy of this executor without any plugins.
     */
    abstract withoutPlugins(): QueryExecutorBase;
}
