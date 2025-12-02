/// <reference types="./on-conflict-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { WhereNode } from './where-node.js';
/**
 * @internal
 */
export const OnConflictNode = freeze({
    is(node) {
        return node.kind === 'OnConflictNode';
    },
    create() {
        return freeze({
            kind: 'OnConflictNode',
        });
    },
    cloneWith(node, props) {
        return freeze({
            ...node,
            ...props,
        });
    },
    cloneWithIndexWhere(node, operation) {
        return freeze({
            ...node,
            indexWhere: node.indexWhere
                ? WhereNode.cloneWithOperation(node.indexWhere, 'And', operation)
                : WhereNode.create(operation),
        });
    },
    cloneWithIndexOrWhere(node, operation) {
        return freeze({
            ...node,
            indexWhere: node.indexWhere
                ? WhereNode.cloneWithOperation(node.indexWhere, 'Or', operation)
                : WhereNode.create(operation),
        });
    },
    cloneWithUpdateWhere(node, operation) {
        return freeze({
            ...node,
            updateWhere: node.updateWhere
                ? WhereNode.cloneWithOperation(node.updateWhere, 'And', operation)
                : WhereNode.create(operation),
        });
    },
    cloneWithUpdateOrWhere(node, operation) {
        return freeze({
            ...node,
            updateWhere: node.updateWhere
                ? WhereNode.cloneWithOperation(node.updateWhere, 'Or', operation)
                : WhereNode.create(operation),
        });
    },
    cloneWithoutIndexWhere(node) {
        return freeze({
            ...node,
            indexWhere: undefined,
        });
    },
    cloneWithoutUpdateWhere(node) {
        return freeze({
            ...node,
            updateWhere: undefined,
        });
    },
});
