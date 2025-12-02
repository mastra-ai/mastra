/// <reference types="./partition-by-item-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const PartitionByItemNode = freeze({
    is(node) {
        return node.kind === 'PartitionByItemNode';
    },
    create(partitionBy) {
        return freeze({
            kind: 'PartitionByItemNode',
            partitionBy,
        });
    },
});
