/// <reference types="./modify-column-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const ModifyColumnNode = freeze({
    is(node) {
        return node.kind === 'ModifyColumnNode';
    },
    create(column) {
        return freeze({
            kind: 'ModifyColumnNode',
            column,
        });
    },
});
