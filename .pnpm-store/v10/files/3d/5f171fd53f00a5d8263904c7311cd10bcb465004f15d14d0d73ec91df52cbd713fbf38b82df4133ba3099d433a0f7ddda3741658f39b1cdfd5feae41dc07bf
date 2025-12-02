/// <reference types="./group-by-item-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const GroupByItemNode = freeze({
    is(node) {
        return node.kind === 'GroupByItemNode';
    },
    create(groupBy) {
        return freeze({
            kind: 'GroupByItemNode',
            groupBy,
        });
    },
});
