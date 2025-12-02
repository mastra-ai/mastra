/// <reference types="./unary-operation-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const UnaryOperationNode = freeze({
    is(node) {
        return node.kind === 'UnaryOperationNode';
    },
    create(operator, operand) {
        return freeze({
            kind: 'UnaryOperationNode',
            operator,
            operand,
        });
    },
});
