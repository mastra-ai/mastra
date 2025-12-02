/// <reference types="./generated-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const GeneratedNode = freeze({
    is(node) {
        return node.kind === 'GeneratedNode';
    },
    create(params) {
        return freeze({
            kind: 'GeneratedNode',
            ...params,
        });
    },
    createWithExpression(expression) {
        return freeze({
            kind: 'GeneratedNode',
            always: true,
            expression,
        });
    },
    cloneWith(node, params) {
        return freeze({
            ...node,
            ...params,
        });
    },
});
