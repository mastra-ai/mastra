/// <reference types="./drop-column-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { ColumnNode } from './column-node.js';
/**
 * @internal
 */
export const DropColumnNode = freeze({
    is(node) {
        return node.kind === 'DropColumnNode';
    },
    create(column) {
        return freeze({
            kind: 'DropColumnNode',
            column: ColumnNode.create(column),
        });
    },
});
