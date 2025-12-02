/// <reference types="./over-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { OrderByNode } from './order-by-node.js';
import { PartitionByNode } from './partition-by-node.js';
/**
 * @internal
 */
export const OverNode = freeze({
    is(node) {
        return node.kind === 'OverNode';
    },
    create() {
        return freeze({
            kind: 'OverNode',
        });
    },
    cloneWithOrderByItems(overNode, items) {
        return freeze({
            ...overNode,
            orderBy: overNode.orderBy
                ? OrderByNode.cloneWithItems(overNode.orderBy, items)
                : OrderByNode.create(items),
        });
    },
    cloneWithPartitionByItems(overNode, items) {
        return freeze({
            ...overNode,
            partitionBy: overNode.partitionBy
                ? PartitionByNode.cloneWithItems(overNode.partitionBy, items)
                : PartitionByNode.create(items),
        });
    },
});
