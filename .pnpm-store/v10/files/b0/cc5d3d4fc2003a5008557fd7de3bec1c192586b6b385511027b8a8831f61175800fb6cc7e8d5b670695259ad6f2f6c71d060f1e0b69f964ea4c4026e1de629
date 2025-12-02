/// <reference types="./update-query-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { FromNode } from './from-node.js';
import { ListNode } from './list-node.js';
/**
 * @internal
 */
export const UpdateQueryNode = freeze({
    is(node) {
        return node.kind === 'UpdateQueryNode';
    },
    create(tables, withNode) {
        return freeze({
            kind: 'UpdateQueryNode',
            // For backwards compatibility, use the raw table node when there's only one table
            // and don't rename the property to something like `tables`.
            table: tables.length === 1 ? tables[0] : ListNode.create(tables),
            ...(withNode && { with: withNode }),
        });
    },
    createWithoutTable() {
        return freeze({
            kind: 'UpdateQueryNode',
        });
    },
    cloneWithFromItems(updateQuery, fromItems) {
        return freeze({
            ...updateQuery,
            from: updateQuery.from
                ? FromNode.cloneWithFroms(updateQuery.from, fromItems)
                : FromNode.create(fromItems),
        });
    },
    cloneWithUpdates(updateQuery, updates) {
        return freeze({
            ...updateQuery,
            updates: updateQuery.updates
                ? freeze([...updateQuery.updates, ...updates])
                : updates,
        });
    },
    cloneWithLimit(updateQuery, limit) {
        return freeze({
            ...updateQuery,
            limit,
        });
    },
});
