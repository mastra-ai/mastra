/// <reference types="./binary-operation-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const BinaryOperationNode = freeze({
    is(node) {
        return node.kind === 'BinaryOperationNode';
    },
    create(leftOperand, operator, rightOperand) {
        return freeze({
            kind: 'BinaryOperationNode',
            leftOperand,
            operator,
            rightOperand,
        });
    },
});
