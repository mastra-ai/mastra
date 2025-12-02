/// <reference types="./partition-by-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const PartitionByNode = freeze({
    is(node) {
        return node.kind === 'PartitionByNode';
    },
    create(items) {
        return freeze({
            kind: 'PartitionByNode',
            items: freeze(items),
        });
    },
    cloneWithItems(partitionBy, items) {
        return freeze({
            ...partitionBy,
            items: freeze([...partitionBy.items, ...items]),
        });
    },
});
