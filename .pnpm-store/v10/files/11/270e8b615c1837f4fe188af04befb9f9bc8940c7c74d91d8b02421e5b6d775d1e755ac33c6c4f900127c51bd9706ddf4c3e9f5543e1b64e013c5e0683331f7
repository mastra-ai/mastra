/// <reference types="./where-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { AndNode } from './and-node.js';
import { OrNode } from './or-node.js';
/**
 * @internal
 */
export const WhereNode = freeze({
    is(node) {
        return node.kind === 'WhereNode';
    },
    create(filter) {
        return freeze({
            kind: 'WhereNode',
            where: filter,
        });
    },
    cloneWithOperation(whereNode, operator, operation) {
        return freeze({
            ...whereNode,
            where: operator === 'And'
                ? AndNode.create(whereNode.where, operation)
                : OrNode.create(whereNode.where, operation),
        });
    },
});
