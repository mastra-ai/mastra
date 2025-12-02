/// <reference types="./selection-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { ReferenceNode } from './reference-node.js';
import { SelectAllNode } from './select-all-node.js';
/**
 * @internal
 */
export const SelectionNode = freeze({
    is(node) {
        return node.kind === 'SelectionNode';
    },
    create(selection) {
        return freeze({
            kind: 'SelectionNode',
            selection: selection,
        });
    },
    createSelectAll() {
        return freeze({
            kind: 'SelectionNode',
            selection: SelectAllNode.create(),
        });
    },
    createSelectAllFromTable(table) {
        return freeze({
            kind: 'SelectionNode',
            selection: ReferenceNode.createSelectAll(table),
        });
    },
});
