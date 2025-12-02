/// <reference types="./group-by-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const GroupByNode = freeze({
    is(node) {
        return node.kind === 'GroupByNode';
    },
    create(items) {
        return freeze({
            kind: 'GroupByNode',
            items: freeze(items),
        });
    },
    cloneWithItems(groupBy, items) {
        return freeze({
            ...groupBy,
            items: freeze([...groupBy.items, ...items]),
        });
    },
});
