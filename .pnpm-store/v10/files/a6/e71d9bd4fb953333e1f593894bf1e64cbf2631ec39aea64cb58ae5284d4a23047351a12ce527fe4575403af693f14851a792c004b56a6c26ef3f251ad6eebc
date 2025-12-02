/// <reference types="./and-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const AndNode = freeze({
    is(node) {
        return node.kind === 'AndNode';
    },
    create(left, right) {
        return freeze({
            kind: 'AndNode',
            left,
            right,
        });
    },
});
