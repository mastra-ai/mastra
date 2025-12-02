import { CompiledQuery } from '../query-compiler/compiled-query.js';
import { KyselyPlugin } from '../plugin/kysely-plugin.js';
import { DialectAdapter } from '../dialect/dialect-adapter.js';
import { QueryExecutorBase } from './query-executor-base.js';
/**
 * A {@link QueryExecutor} subclass that can be used when you don't
 * have a {@link QueryCompiler}, {@link ConnectionProvider} or any
 * other needed things to actually execute queries.
 */
export declare class NoopQueryExecutor extends QueryExecutorBase {
    /**
     * Returns the adapter for the current dialect.
     */
    get adapter(): DialectAdapter;
    /**
     * Compiles the transformed query into SQL. You usually want to pass
     * the output of {@link transformQuery} into this method but you can
     * compile any query using this method.
     */
    compileQuery(): CompiledQuery;
    /**
     * Provides a connection for the callback and takes care of disposing
     * the connection after the callback has been run.
     */
    provideConnection<T>(): Promise<T>;
    /**
     * Returns a copy of this executor with a new connection provider.
     */
    withConnectionProvider(): NoopQueryExecutor;
    /**
     * Returns a copy of this executor with a plugin added as the
     * last plugin.
     */
    withPlugin(plugin: KyselyPlugin): NoopQueryExecutor;
    /**
     * Returns a copy of this executor with a list of plugins added
     * as the last plugins.
     */
    withPlugins(plugins: ReadonlyArray<KyselyPlugin>): NoopQueryExecutor;
    /**
     * Returns a copy of this executor with a plugin added as the
     * first plugin.
     */
    withPluginAtFront(plugin: KyselyPlugin): NoopQueryExecutor;
    /**
     * Returns a copy of this executor without any plugins.
     */
    withoutPlugins(): NoopQueryExecutor;
}
export declare const NOOP_QUERY_EXECUTOR: NoopQueryExecutor;
