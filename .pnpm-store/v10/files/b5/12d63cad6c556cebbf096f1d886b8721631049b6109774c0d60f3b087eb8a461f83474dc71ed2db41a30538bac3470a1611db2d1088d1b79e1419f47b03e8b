"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOOP_QUERY_EXECUTOR = exports.NoopQueryExecutor = void 0;
const query_executor_base_js_1 = require("./query-executor-base.js");
/**
 * A {@link QueryExecutor} subclass that can be used when you don't
 * have a {@link QueryCompiler}, {@link ConnectionProvider} or any
 * other needed things to actually execute queries.
 */
class NoopQueryExecutor extends query_executor_base_js_1.QueryExecutorBase {
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
exports.NoopQueryExecutor = NoopQueryExecutor;
exports.NOOP_QUERY_EXECUTOR = new NoopQueryExecutor();
