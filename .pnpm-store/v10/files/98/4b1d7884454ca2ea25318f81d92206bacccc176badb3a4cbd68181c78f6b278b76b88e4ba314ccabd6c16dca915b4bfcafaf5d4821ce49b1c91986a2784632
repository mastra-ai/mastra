"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshMaterializedViewBuilder = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const refresh_materialized_view_node_js_1 = require("../operation-node/refresh-materialized-view-node.js");
class RefreshMaterializedViewBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    /**
     * Adds the "concurrently" modifier.
     *
     * Use this to refresh the view without locking out concurrent selects on the materialized view.
     *
     * WARNING!
     * This cannot be used with the "with no data" modifier.
     */
    concurrently() {
        return new RefreshMaterializedViewBuilder({
            ...this.#props,
            node: refresh_materialized_view_node_js_1.RefreshMaterializedViewNode.cloneWith(this.#props.node, {
                concurrently: true,
                withNoData: false,
            }),
        });
    }
    /**
     * Adds the "with data" modifier.
     *
     * If specified (or defaults) the backing query is executed to provide the new data, and the materialized view is left in a scannable state
     */
    withData() {
        return new RefreshMaterializedViewBuilder({
            ...this.#props,
            node: refresh_materialized_view_node_js_1.RefreshMaterializedViewNode.cloneWith(this.#props.node, {
                withNoData: false,
            }),
        });
    }
    /**
     * Adds the "with no data" modifier.
     *
     * If specified, no new data is generated and the materialized view is left in an unscannable state.
     *
     * WARNING!
     * This cannot be used with the "concurrently" modifier.
     */
    withNoData() {
        return new RefreshMaterializedViewBuilder({
            ...this.#props,
            node: refresh_materialized_view_node_js_1.RefreshMaterializedViewNode.cloneWith(this.#props.node, {
                withNoData: true,
                concurrently: false,
            }),
        });
    }
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call(func) {
        return func(this);
    }
    toOperationNode() {
        return this.#props.executor.transformQuery(this.#props.node, this.#props.queryId);
    }
    compile() {
        return this.#props.executor.compileQuery(this.toOperationNode(), this.#props.queryId);
    }
    async execute() {
        await this.#props.executor.executeQuery(this.compile());
    }
}
exports.RefreshMaterializedViewBuilder = RefreshMaterializedViewBuilder;
