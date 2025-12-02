/// <reference types="./check-constraint-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { IdentifierNode } from './identifier-node.js';
/**
 * @internal
 */
export const CheckConstraintNode = freeze({
    is(node) {
        return node.kind === 'CheckConstraintNode';
    },
    create(expression, constraintName) {
        return freeze({
            kind: 'CheckConstraintNode',
            expression,
            name: constraintName ? IdentifierNode.create(constraintName) : undefined,
        });
    },
});
