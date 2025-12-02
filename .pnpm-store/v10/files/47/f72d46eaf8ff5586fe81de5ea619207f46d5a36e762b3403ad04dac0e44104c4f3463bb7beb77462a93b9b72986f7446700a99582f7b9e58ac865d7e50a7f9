/// <reference types="./column-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { IdentifierNode } from './identifier-node.js';
/**
 * @internal
 */
export const ColumnNode = freeze({
    is(node) {
        return node.kind === 'ColumnNode';
    },
    create(column) {
        return freeze({
            kind: 'ColumnNode',
            column: IdentifierNode.create(column),
        });
    },
});
