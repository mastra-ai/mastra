/// <reference types="./order-by-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const OrderByNode = freeze({
    is(node) {
        return node.kind === 'OrderByNode';
    },
    create(items) {
        return freeze({
            kind: 'OrderByNode',
            items: freeze([...items]),
        });
    },
    cloneWithItems(orderBy, items) {
        return freeze({
            ...orderBy,
            items: freeze([...orderBy.items, ...items]),
        });
    },
});
