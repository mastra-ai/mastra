"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultQueryExecutor = void 0;
const query_executor_base_js_1 = require("./query-executor-base.js");
class DefaultQueryExecutor extends query_executor_base_js_1.QueryExecutorBase {
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
exports.DefaultQueryExecutor = DefaultQueryExecutor;
