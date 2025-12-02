/// <reference types="./parens-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const ParensNode = freeze({
    is(node) {
        return node.kind === 'ParensNode';
    },
    create(node) {
        return freeze({
            kind: 'ParensNode',
            node,
        });
    },
});
