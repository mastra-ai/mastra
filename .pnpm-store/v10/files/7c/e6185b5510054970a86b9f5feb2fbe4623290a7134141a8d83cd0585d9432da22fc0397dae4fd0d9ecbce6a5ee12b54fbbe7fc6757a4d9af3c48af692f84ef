/// <reference types="./refresh-materialized-view-builder.d.ts" />
import { freeze } from '../util/object-utils.js';
import { RefreshMaterializedViewNode } from '../operation-node/refresh-materialized-view-node.js';
export class RefreshMaterializedViewBuilder {
    #props;
    constructor(props) {
        this.#props = freeze(props);
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
            node: RefreshMaterializedViewNode.cloneWith(this.#props.node, {
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
            node: RefreshMaterializedViewNode.cloneWith(this.#props.node, {
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
            node: RefreshMaterializedViewNode.cloneWith(this.#props.node, {
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
