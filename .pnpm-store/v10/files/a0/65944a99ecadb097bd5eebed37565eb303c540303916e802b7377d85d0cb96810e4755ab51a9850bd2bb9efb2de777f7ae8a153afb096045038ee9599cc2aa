/// <reference types="./or-action-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const OrActionNode = freeze({
    is(node) {
        return node.kind === 'OrActionNode';
    },
    create(action) {
        return freeze({
            kind: 'OrActionNode',
            action,
        });
    },
});
