/// <reference types="./when-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const WhenNode = freeze({
    is(node) {
        return node.kind === 'WhenNode';
    },
    create(condition) {
        return freeze({
            kind: 'WhenNode',
            condition,
        });
    },
    cloneWithResult(whenNode, result) {
        return freeze({
            ...whenNode,
            result,
        });
    },
});
