/// <reference types="./column-update-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const ColumnUpdateNode = freeze({
    is(node) {
        return node.kind === 'ColumnUpdateNode';
    },
    create(column, value) {
        return freeze({
            kind: 'ColumnUpdateNode',
            column,
            value,
        });
    },
});
