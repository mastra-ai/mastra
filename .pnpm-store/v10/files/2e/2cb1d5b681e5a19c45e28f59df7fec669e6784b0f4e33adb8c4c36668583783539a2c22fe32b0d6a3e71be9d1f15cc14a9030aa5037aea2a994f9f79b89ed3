/// <reference types="./top-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const TopNode = freeze({
    is(node) {
        return node.kind === 'TopNode';
    },
    create(expression, modifiers) {
        return freeze({
            kind: 'TopNode',
            expression,
            modifiers,
        });
    },
});
