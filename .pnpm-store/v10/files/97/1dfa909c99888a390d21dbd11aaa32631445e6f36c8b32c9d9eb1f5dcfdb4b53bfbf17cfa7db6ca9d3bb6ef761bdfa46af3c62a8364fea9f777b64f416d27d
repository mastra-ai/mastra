/// <reference types="./order-by-item-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const OrderByItemNode = freeze({
    is(node) {
        return node.kind === 'OrderByItemNode';
    },
    create(orderBy, direction) {
        return freeze({
            kind: 'OrderByItemNode',
            orderBy,
            direction,
        });
    },
    cloneWith(node, props) {
        return freeze({
            ...node,
            ...props,
        });
    },
});
