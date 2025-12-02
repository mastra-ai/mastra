/// <reference types="./with-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const WithNode = freeze({
    is(node) {
        return node.kind === 'WithNode';
    },
    create(expression, params) {
        return freeze({
            kind: 'WithNode',
            expressions: freeze([expression]),
            ...params,
        });
    },
    cloneWithExpression(withNode, expression) {
        return freeze({
            ...withNode,
            expressions: freeze([...withNode.expressions, expression]),
        });
    },
});
