/// <reference types="./rename-constraint-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { IdentifierNode } from './identifier-node.js';
/**
 * @internal
 */
export const RenameConstraintNode = freeze({
    is(node) {
        return node.kind === 'RenameConstraintNode';
    },
    create(oldName, newName) {
        return freeze({
            kind: 'RenameConstraintNode',
            oldName: IdentifierNode.create(oldName),
            newName: IdentifierNode.create(newName),
        });
    },
});
