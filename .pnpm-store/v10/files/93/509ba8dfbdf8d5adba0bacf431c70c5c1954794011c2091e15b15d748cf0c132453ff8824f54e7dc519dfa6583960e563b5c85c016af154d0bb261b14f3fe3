/// <reference types="./delete-query-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { FromNode } from './from-node.js';
import { UsingNode } from './using-node.js';
import { QueryNode } from './query-node.js';
/**
 * @internal
 */
export const DeleteQueryNode = freeze({
    is(node) {
        return node.kind === 'DeleteQueryNode';
    },
    create(fromItems, withNode) {
        return freeze({
            kind: 'DeleteQueryNode',
            from: FromNode.create(fromItems),
            ...(withNode && { with: withNode }),
        });
    },
    // TODO: remove in v0.29
    /**
     * @deprecated Use `QueryNode.cloneWithoutOrderBy` instead.
     */
    cloneWithOrderByItems: (node, items) => QueryNode.cloneWithOrderByItems(node, items),
    // TODO: remove in v0.29
    /**
     * @deprecated Use `QueryNode.cloneWithoutOrderBy` instead.
     */
    cloneWithoutOrderBy: (node) => QueryNode.cloneWithoutOrderBy(node),
    cloneWithLimit(deleteNode, limit) {
        return freeze({
            ...deleteNode,
            limit,
        });
    },
    cloneWithoutLimit(deleteNode) {
        return freeze({
            ...deleteNode,
            limit: undefined,
        });
    },
    cloneWithUsing(deleteNode, tables) {
        return freeze({
            ...deleteNode,
            using: deleteNode.using !== undefined
                ? UsingNode.cloneWithTables(deleteNode.using, tables)
                : UsingNode.create(tables),
        });
    },
});
