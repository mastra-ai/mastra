/// <reference types="./default-query-executor.d.ts" />
import { QueryExecutorBase } from './query-executor-base.js';
export class DefaultQueryExecutor extends QueryExecutorBase {
    #compiler;
    #adapter;
    #connectionProvider;
    constructor(compiler, adapter, connectionProvider, plugins = []) {
        super(plugins);
        this.#compiler = compiler;
        this.#adapter = adapter;
        this.#connectionProvider = connectionProvider;
    }
    get adapter() {
        return this.#adapter;
    }
    compileQuery(node, queryId) {
        return this.#compiler.compileQuery(node, queryId);
    }
    provideConnection(consumer) {
        return this.#connectionProvider.provideConnection(consumer);
    }
    withPlugins(plugins) {
        return new DefaultQueryExecutor(this.#compiler, this.#adapter, this.#connectionProvider, [...this.plugins, ...plugins]);
    }
    withPlugin(plugin) {
        return new DefaultQueryExecutor(this.#compiler, this.#adapter, this.#connectionProvider, [...this.plugins, plugin]);
    }
    withPluginAtFront(plugin) {
        return new DefaultQueryExecutor(this.#compiler, this.#adapter, this.#connectionProvider, [plugin, ...this.plugins]);
    }
    withConnectionProvider(connectionProvider) {
        return new DefaultQueryExecutor(this.#compiler, this.#adapter, connectionProvider, [...this.plugins]);
    }
    withoutPlugins() {
        return new DefaultQueryExecutor(this.#compiler, this.#adapter, this.#connectionProvider, []);
    }
}
