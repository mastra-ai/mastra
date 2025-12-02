/// <reference types="./select-modifier-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const SelectModifierNode = freeze({
    is(node) {
        return node.kind === 'SelectModifierNode';
    },
    create(modifier, of) {
        return freeze({
            kind: 'SelectModifierNode',
            modifier,
            of,
        });
    },
    createWithExpression(modifier) {
        return freeze({
            kind: 'SelectModifierNode',
            rawModifier: modifier,
        });
    },
});
