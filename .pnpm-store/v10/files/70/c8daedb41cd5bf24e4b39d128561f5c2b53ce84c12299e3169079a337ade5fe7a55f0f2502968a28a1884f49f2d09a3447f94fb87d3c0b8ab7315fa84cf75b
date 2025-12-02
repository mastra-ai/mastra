/// <reference types="./having-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { AndNode } from './and-node.js';
import { OrNode } from './or-node.js';
/**
 * @internal
 */
export const HavingNode = freeze({
    is(node) {
        return node.kind === 'HavingNode';
    },
    create(filter) {
        return freeze({
            kind: 'HavingNode',
            having: filter,
        });
    },
    cloneWithOperation(havingNode, operator, operation) {
        return freeze({
            ...havingNode,
            having: operator === 'And'
                ? AndNode.create(havingNode.having, operation)
                : OrNode.create(havingNode.having, operation),
        });
    },
});
