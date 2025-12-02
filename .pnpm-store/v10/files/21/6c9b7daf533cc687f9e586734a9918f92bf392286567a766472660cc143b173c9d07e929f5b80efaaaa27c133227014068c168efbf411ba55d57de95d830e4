/// <reference types="./json-reference-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const JSONReferenceNode = freeze({
    is(node) {
        return node.kind === 'JSONReferenceNode';
    },
    create(reference, traversal) {
        return freeze({
            kind: 'JSONReferenceNode',
            reference,
            traversal,
        });
    },
    cloneWithTraversal(node, traversal) {
        return freeze({
            ...node,
            traversal,
        });
    },
});
