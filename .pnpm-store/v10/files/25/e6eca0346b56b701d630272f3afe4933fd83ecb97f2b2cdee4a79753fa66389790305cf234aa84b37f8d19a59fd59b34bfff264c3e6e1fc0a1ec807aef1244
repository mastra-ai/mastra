/// <reference types="./noop-query-executor.d.ts" />
import { QueryExecutorBase } from './query-executor-base.js';
/**
 * A {@link QueryExecutor} subclass that can be used when you don't
 * have a {@link QueryCompiler}, {@link ConnectionProvider} or any
 * other needed things to actually execute queries.
 */
export class NoopQueryExecutor extends QueryExecutorBase {
    get adapter() {
        throw new Error('this query cannot be compiled to SQL');
    }
    compileQuery() {
        throw new Error('this query cannot be compiled to SQL');
    }
    provideConnection() {
        throw new Error('this query cannot be executed');
    }
    withConnectionProvider() {
        throw new Error('this query cannot have a connection provider');
    }
    withPlugin(plugin) {
        return new NoopQueryExecutor([...this.plugins, plugin]);
    }
    withPlugins(plugins) {
        return new NoopQueryExecutor([...this.plugins, ...plugins]);
    }
    withPluginAtFront(plugin) {
        return new NoopQueryExecutor([plugin, ...this.plugins]);
    }
    withoutPlugins() {
        return new NoopQueryExecutor([]);
    }
}
export const NOOP_QUERY_EXECUTOR = new NoopQueryExecutor();
