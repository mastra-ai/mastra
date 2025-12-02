/// <reference types="./or-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const OrNode = freeze({
    is(node) {
        return node.kind === 'OrNode';
    },
    create(left, right) {
        return freeze({
            kind: 'OrNode',
            left,
            right,
        });
    },
});
