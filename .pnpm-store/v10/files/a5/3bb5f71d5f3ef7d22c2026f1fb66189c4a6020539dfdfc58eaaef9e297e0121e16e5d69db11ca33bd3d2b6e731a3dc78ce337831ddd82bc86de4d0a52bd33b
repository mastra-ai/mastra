/// <reference types="./list-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const ListNode = freeze({
    is(node) {
        return node.kind === 'ListNode';
    },
    create(items) {
        return freeze({
            kind: 'ListNode',
            items: freeze(items),
        });
    },
});
