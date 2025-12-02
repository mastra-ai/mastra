"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRawBuilder = createRawBuilder;
const alias_node_js_1 = require("../operation-node/alias-node.js");
const object_utils_js_1 = require("../util/object-utils.js");
const noop_query_executor_js_1 = require("../query-executor/noop-query-executor.js");
const identifier_node_js_1 = require("../operation-node/identifier-node.js");
const operation_node_source_js_1 = require("../operation-node/operation-node-source.js");
class RawBuilderImpl {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    get expressionType() {
        return undefined;
    }
    get isRawBuilder() {
        return true;
    }
    as(alias) {
        return new AliasedRawBuilderImpl(this, alias);
    }
    $castTo() {
        return new RawBuilderImpl({ ...this.#props });
    }
    $notNull() {
        return new RawBuilderImpl(this.#props);
    }
    withPlugin(plugin) {
        return new RawBuilderImpl({
            ...this.#props,
            plugins: this.#props.plugins !== undefined
                ? (0, object_utils_js_1.freeze)([...this.#props.plugins, plugin])
                : (0, object_utils_js_1.freeze)([plugin]),
        });
    }
    toOperationNode() {
        return this.#toOperationNode(this.#getExecutor());
    }
    compile(executorProvider) {
        return this.#compile(this.#getExecutor(executorProvider));
    }
    async execute(executorProvider) {
        const executor = this.#getExecutor(executorProvider);
        return executor.executeQuery(this.#compile(executor));
    }
    #getExecutor(executorProvider) {
        const executor = executorProvider !== undefined
            ? executorProvider.getExecutor()
            : noop_query_executor_js_1.NOOP_QUERY_EXECUTOR;
        return this.#props.plugins !== undefined
            ? executor.withPlugins(this.#props.plugins)
            : executor;
    }
    #toOperationNode(executor) {
        return executor.transformQuery(this.#props.rawNode, this.#props.queryId);
    }
    #compile(executor) {
        return executor.compileQuery(this.#toOperationNode(executor), this.#props.queryId);
    }
}
function createRawBuilder(props) {
    return new RawBuilderImpl(props);
}
class AliasedRawBuilderImpl {
    #rawBuilder;
    #alias;
    constructor(rawBuilder, alias) {
        this.#rawBuilder = rawBuilder;
        this.#alias = alias;
    }
    get expression() {
        return this.#rawBuilder;
    }
    get alias() {
        return this.#alias;
    }
    get rawBuilder() {
        return this.#rawBuilder;
    }
    toOperationNode() {
        return alias_node_js_1.AliasNode.create(this.#rawBuilder.toOperationNode(), (0, operation_node_source_js_1.isOperationNodeSource)(this.#alias)
            ? this.#alias.toOperationNode()
            : identifier_node_js_1.IdentifierNode.create(this.#alias));
    }
}
