import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { OrderByItemNode } from '../operation-node/order-by-item-node.js';
import { Collation } from '../parser/collate-parser.js';
export declare class OrderByItemBuilder implements OperationNodeSource {
    #private;
    constructor(props: OrderByItemBuilderProps);
    /**
     * Adds `desc` to the `order by` item.
     *
     * See {@link asc} for the opposite.
     */
    desc(): OrderByItemBuilder;
    /**
     * Adds `asc` to the `order by` item.
     *
     * See {@link desc} for the opposite.
     */
    asc(): OrderByItemBuilder;
    /**
     * Adds `nulls last` to the `order by` item.
     *
     * This is only supported by some dialects like PostgreSQL and SQLite.
     *
     * See {@link nullsFirst} for the opposite.
     */
    nullsLast(): OrderByItemBuilder;
    /**
     * Adds `nulls first` to the `order by` item.
     *
     * This is only supported by some dialects like PostgreSQL and SQLite.
     *
     * See {@link nullsLast} for the opposite.
     */
    nullsFirst(): OrderByItemBuilder;
    /**
     * Adds `collate <collationName>` to the `order by` item.
     */
    collate(collation: Collation): OrderByItemBuilder;
    toOperationNode(): OrderByItemNode;
}
export interface OrderByItemBuilderProps {
    readonly node: OrderByItemNode;
}
