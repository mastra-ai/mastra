/// <reference types="./reference-node.d.ts" />
import { SelectAllNode } from './select-all-node.js';
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const ReferenceNode = freeze({
    is(node) {
        return node.kind === 'ReferenceNode';
    },
    create(column, table) {
        return freeze({
            kind: 'ReferenceNode',
            table,
            column,
        });
    },
    createSelectAll(table) {
        return freeze({
            kind: 'ReferenceNode',
            table,
            column: SelectAllNode.create(),
        });
    },
});
