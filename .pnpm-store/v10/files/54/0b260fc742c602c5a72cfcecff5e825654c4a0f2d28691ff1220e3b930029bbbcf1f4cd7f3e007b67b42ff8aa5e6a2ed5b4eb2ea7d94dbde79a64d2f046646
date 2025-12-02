/// <reference types="./references-node.d.ts" />
import { freeze } from '../util/object-utils.js';
export const ON_MODIFY_FOREIGN_ACTIONS = [
    'no action',
    'restrict',
    'cascade',
    'set null',
    'set default',
];
/**
 * @internal
 */
export const ReferencesNode = freeze({
    is(node) {
        return node.kind === 'ReferencesNode';
    },
    create(table, columns) {
        return freeze({
            kind: 'ReferencesNode',
            table,
            columns: freeze([...columns]),
        });
    },
    cloneWithOnDelete(references, onDelete) {
        return freeze({
            ...references,
            onDelete,
        });
    },
    cloneWithOnUpdate(references, onUpdate) {
        return freeze({
            ...references,
            onUpdate,
        });
    },
});
