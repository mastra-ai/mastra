/// <reference types="./common-table-expression-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const CommonTableExpressionNode = freeze({
    is(node) {
        return node.kind === 'CommonTableExpressionNode';
    },
    create(name, expression) {
        return freeze({
            kind: 'CommonTableExpressionNode',
            name,
            expression,
        });
    },
    cloneWith(node, props) {
        return freeze({
            ...node,
            ...props,
        });
    },
});
