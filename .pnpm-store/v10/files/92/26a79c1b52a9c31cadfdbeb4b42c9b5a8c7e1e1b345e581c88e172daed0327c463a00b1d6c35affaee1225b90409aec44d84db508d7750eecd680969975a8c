import { ConnectionProvider } from '../driver/connection-provider.js';
import { DatabaseConnection } from '../driver/database-connection.js';
import { CompiledQuery } from '../query-compiler/compiled-query.js';
import { RootOperationNode, QueryCompiler } from '../query-compiler/query-compiler.js';
import { KyselyPlugin } from '../plugin/kysely-plugin.js';
import { QueryExecutorBase } from './query-executor-base.js';
import { DialectAdapter } from '../dialect/dialect-adapter.js';
import { QueryId } from '../util/query-id.js';
export declare class DefaultQueryExecutor extends QueryExecutorBase {
    #private;
    constructor(compiler: QueryCompiler, adapter: DialectAdapter, connectionProvider: ConnectionProvider, plugins?: KyselyPlugin[]);
    /**
     * Returns the adapter for the current dialect.
     */
    get adapter(): DialectAdapter;
    /**
     * Compiles the transformed query into SQL. You usually want to pass
     * the output of {@link transformQuery} into this method but you can
     * compile any query using this method.
     */
    compileQuery(node: RootOperationNode, queryId: QueryId): CompiledQuery;
    /**
     * Provides a connection for the callback and takes care of disposing
     * the connection after the callback has been run.
     */
    provideConnection<T>(consumer: (connection: DatabaseConnection) => Promise<T>): Promise<T>;
    /**
     * Returns a copy of this executor with a list of plugins added
     * as the last plugins.
     */
    withPlugins(plugins: ReadonlyArray<KyselyPlugin>): DefaultQueryExecutor;
    /**
     * Returns a copy of this executor with a plugin added as the
     * last plugin.
     */
    withPlugin(plugin: KyselyPlugin): DefaultQueryExecutor;
    /**
     * Returns a copy of this executor with a plugin added as the
     * first plugin.
     */
    withPluginAtFront(plugin: KyselyPlugin): DefaultQueryExecutor;
    /**
     * Returns a copy of this executor with a new connection provider.
     */
    withConnectionProvider(connectionProvider: ConnectionProvider): DefaultQueryExecutor;
    /**
     * Returns a copy of this executor without any plugins.
     */
    withoutPlugins(): DefaultQueryExecutor;
}
