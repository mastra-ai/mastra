/// <reference types="./on-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { AndNode } from './and-node.js';
import { OrNode } from './or-node.js';
/**
 * @internal
 */
export const OnNode = freeze({
    is(node) {
        return node.kind === 'OnNode';
    },
    create(filter) {
        return freeze({
            kind: 'OnNode',
            on: filter,
        });
    },
    cloneWithOperation(onNode, operator, operation) {
        return freeze({
            ...onNode,
            on: operator === 'And'
                ? AndNode.create(onNode.on, operation)
                : OrNode.create(onNode.on, operation),
        });
    },
});
