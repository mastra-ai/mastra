/// <reference types="./add-column-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const AddColumnNode = freeze({
    is(node) {
        return node.kind === 'AddColumnNode';
    },
    create(column) {
        return freeze({
            kind: 'AddColumnNode',
            column,
        });
    },
});
