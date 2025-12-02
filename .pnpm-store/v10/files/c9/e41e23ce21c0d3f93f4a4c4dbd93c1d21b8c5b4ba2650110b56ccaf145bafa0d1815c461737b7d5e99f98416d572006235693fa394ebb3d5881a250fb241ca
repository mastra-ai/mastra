/// <reference types="./add-constraint-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const AddConstraintNode = freeze({
    is(node) {
        return node.kind === 'AddConstraintNode';
    },
    create(constraint) {
        return freeze({
            kind: 'AddConstraintNode',
            constraint,
        });
    },
});
