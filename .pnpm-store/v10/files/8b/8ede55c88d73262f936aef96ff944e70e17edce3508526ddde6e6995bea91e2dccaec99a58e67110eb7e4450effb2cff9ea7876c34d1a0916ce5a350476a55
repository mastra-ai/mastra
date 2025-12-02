/// <reference types="./value-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const ValueNode = freeze({
    is(node) {
        return node.kind === 'ValueNode';
    },
    create(value) {
        return freeze({
            kind: 'ValueNode',
            value,
        });
    },
    createImmediate(value) {
        return freeze({
            kind: 'ValueNode',
            value,
            immediate: true,
        });
    },
});
