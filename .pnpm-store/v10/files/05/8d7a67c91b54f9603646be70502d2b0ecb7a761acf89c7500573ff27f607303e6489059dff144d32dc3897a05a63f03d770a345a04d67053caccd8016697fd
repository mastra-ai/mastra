/// <reference types="./primary-key-constraint-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { ColumnNode } from './column-node.js';
import { IdentifierNode } from './identifier-node.js';
/**
 * @internal
 */
export const PrimaryKeyConstraintNode = freeze({
    is(node) {
        return node.kind === 'PrimaryKeyConstraintNode';
    },
    create(columns, constraintName) {
        return freeze({
            kind: 'PrimaryKeyConstraintNode',
            columns: freeze(columns.map(ColumnNode.create)),
            name: constraintName ? IdentifierNode.create(constraintName) : undefined,
        });
    },
    cloneWith(node, props) {
        return freeze({ ...node, ...props });
    },
});
/**
 * Backwards compatibility for a typo in the codebase.
 *
 * @deprecated Use {@link PrimaryKeyConstraintNode} instead.
 */
export const PrimaryConstraintNode = PrimaryKeyConstraintNode;
