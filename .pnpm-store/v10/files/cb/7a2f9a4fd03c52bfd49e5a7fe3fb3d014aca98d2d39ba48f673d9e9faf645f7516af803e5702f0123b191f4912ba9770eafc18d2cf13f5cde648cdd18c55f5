/// <reference types="./join-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { OnNode } from './on-node.js';
/**
 * @internal
 */
export const JoinNode = freeze({
    is(node) {
        return node.kind === 'JoinNode';
    },
    create(joinType, table) {
        return freeze({
            kind: 'JoinNode',
            joinType,
            table,
            on: undefined,
        });
    },
    createWithOn(joinType, table, on) {
        return freeze({
            kind: 'JoinNode',
            joinType,
            table,
            on: OnNode.create(on),
        });
    },
    cloneWithOn(joinNode, operation) {
        return freeze({
            ...joinNode,
            on: joinNode.on
                ? OnNode.cloneWithOperation(joinNode.on, 'And', operation)
                : OnNode.create(operation),
        });
    },
});
