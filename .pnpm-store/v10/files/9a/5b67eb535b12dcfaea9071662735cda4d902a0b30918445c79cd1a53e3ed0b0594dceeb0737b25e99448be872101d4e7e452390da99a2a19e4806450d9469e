/// <reference types="./foreign-key-constraint-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { IdentifierNode } from './identifier-node.js';
import { ReferencesNode } from './references-node.js';
/**
 * @internal
 */
export const ForeignKeyConstraintNode = freeze({
    is(node) {
        return node.kind === 'ForeignKeyConstraintNode';
    },
    create(sourceColumns, targetTable, targetColumns, constraintName) {
        return freeze({
            kind: 'ForeignKeyConstraintNode',
            columns: sourceColumns,
            references: ReferencesNode.create(targetTable, targetColumns),
            name: constraintName ? IdentifierNode.create(constraintName) : undefined,
        });
    },
    cloneWith(node, props) {
        return freeze({
            ...node,
            ...props,
        });
    },
});
