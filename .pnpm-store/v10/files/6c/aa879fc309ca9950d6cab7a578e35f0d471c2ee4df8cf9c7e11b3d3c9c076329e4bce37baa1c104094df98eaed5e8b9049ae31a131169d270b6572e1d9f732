/// <reference types="./drop-constraint-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { IdentifierNode } from './identifier-node.js';
/**
 * @internal
 */
export const DropConstraintNode = freeze({
    is(node) {
        return node.kind === 'DropConstraintNode';
    },
    create(constraintName) {
        return freeze({
            kind: 'DropConstraintNode',
            constraintName: IdentifierNode.create(constraintName),
        });
    },
    cloneWith(dropConstraint, props) {
        return freeze({
            ...dropConstraint,
            ...props,
        });
    },
});
