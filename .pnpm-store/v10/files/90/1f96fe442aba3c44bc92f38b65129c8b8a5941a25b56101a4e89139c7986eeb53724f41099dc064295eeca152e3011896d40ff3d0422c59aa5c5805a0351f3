/// <reference types="./rename-column-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { ColumnNode } from './column-node.js';
/**
 * @internal
 */
export const RenameColumnNode = freeze({
    is(node) {
        return node.kind === 'RenameColumnNode';
    },
    create(column, newColumn) {
        return freeze({
            kind: 'RenameColumnNode',
            column: ColumnNode.create(column),
            renameTo: ColumnNode.create(newColumn),
        });
    },
});
