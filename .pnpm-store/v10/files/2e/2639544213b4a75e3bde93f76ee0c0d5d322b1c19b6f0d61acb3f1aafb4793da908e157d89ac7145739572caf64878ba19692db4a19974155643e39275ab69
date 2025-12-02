/// <reference types="./value-list-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const ValueListNode = freeze({
    is(node) {
        return node.kind === 'ValueListNode';
    },
    create(values) {
        return freeze({
            kind: 'ValueListNode',
            values: freeze(values),
        });
    },
});
