/// <reference types="./create-view-builder.d.ts" />
import { freeze } from '../util/object-utils.js';
import { CreateViewNode } from '../operation-node/create-view-node.js';
import { parseColumnName } from '../parser/reference-parser.js';
import { ImmediateValuePlugin } from '../plugin/immediate-value/immediate-value-plugin.js';
export class CreateViewBuilder {
    #props;
    constructor(props) {
        this.#props = freeze(props);
    }
    /**
     * Adds the "temporary" modifier.
     *
     * Use this to create a temporary view.
     */
    temporary() {
        return new CreateViewBuilder({
            ...this.#props,
            node: CreateViewNode.cloneWith(this.#props.node, {
                temporary: true,
            }),
        });
    }
    materialized() {
        return new CreateViewBuilder({
            ...this.#props,
            node: CreateViewNode.cloneWith(this.#props.node, {
                materialized: true,
            }),
        });
    }
    /**
     * Only implemented on some dialects like SQLite. On most dialects, use {@link orReplace}.
     */
    ifNotExists() {
        return new CreateViewBuilder({
            ...this.#props,
            node: CreateViewNode.cloneWith(this.#props.node, {
                ifNotExists: true,
            }),
        });
    }
    orReplace() {
        return new CreateViewBuilder({
            ...this.#props,
            node: CreateViewNode.cloneWith(this.#props.node, {
                orReplace: true,
            }),
        });
    }
    columns(columns) {
        return new CreateViewBuilder({
            ...this.#props,
            node: CreateViewNode.cloneWith(this.#props.node, {
                columns: columns.map(parseColumnName),
            }),
        });
    }
    /**
     * Sets the select query or a `values` statement that creates the view.
     *
     * WARNING!
     * Some dialects don't support parameterized queries in DDL statements and therefore
     * the query or raw {@link sql } expression passed here is interpolated into a single
     * string opening an SQL injection vulnerability. DO NOT pass unchecked user input
     * into the query or raw expression passed to this method!
     */
    as(query) {
        const queryNode = query
            .withPlugin(new ImmediateValuePlugin())
            .toOperationNode();
        return new CreateViewBuilder({
            ...this.#props,
            node: CreateViewNode.cloneWith(this.#props.node, {
                as: queryNode,
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
