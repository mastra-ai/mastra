/// <reference types="./unique-constraint-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { ColumnNode } from './column-node.js';
import { IdentifierNode } from './identifier-node.js';
/**
 * @internal
 */
export const UniqueConstraintNode = freeze({
    is(node) {
        return node.kind === 'UniqueConstraintNode';
    },
    create(columns, constraintName, nullsNotDistinct) {
        return freeze({
            kind: 'UniqueConstraintNode',
            columns: freeze(columns.map(ColumnNode.create)),
            name: constraintName ? IdentifierNode.create(constraintName) : undefined,
            nullsNotDistinct,
        });
    },
    cloneWith(node, props) {
        return freeze({
            ...node,
            ...props,
        });
    },
});
