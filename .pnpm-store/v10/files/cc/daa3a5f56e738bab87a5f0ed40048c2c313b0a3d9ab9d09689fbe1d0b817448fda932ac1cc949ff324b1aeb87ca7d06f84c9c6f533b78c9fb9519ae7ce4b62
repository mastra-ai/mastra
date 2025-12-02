/// <reference types="./alter-column-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { ColumnNode } from './column-node.js';
/**
 * @internal
 */
export const AlterColumnNode = freeze({
    is(node) {
        return node.kind === 'AlterColumnNode';
    },
    create(column, prop, value) {
        return freeze({
            kind: 'AlterColumnNode',
            column: ColumnNode.create(column),
            [prop]: value,
        });
    },
});
