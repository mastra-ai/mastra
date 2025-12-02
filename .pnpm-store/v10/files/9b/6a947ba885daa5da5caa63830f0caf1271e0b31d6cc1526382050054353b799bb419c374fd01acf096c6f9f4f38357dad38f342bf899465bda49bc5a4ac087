/// <reference types="./select-query-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { FromNode } from './from-node.js';
import { GroupByNode } from './group-by-node.js';
import { HavingNode } from './having-node.js';
import { QueryNode } from './query-node.js';
/**
 * @internal
 */
export const SelectQueryNode = freeze({
    is(node) {
        return node.kind === 'SelectQueryNode';
    },
    create(withNode) {
        return freeze({
            kind: 'SelectQueryNode',
            ...(withNode && { with: withNode }),
        });
    },
    createFrom(fromItems, withNode) {
        return freeze({
            kind: 'SelectQueryNode',
            from: FromNode.create(fromItems),
            ...(withNode && { with: withNode }),
        });
    },
    cloneWithSelections(select, selections) {
        return freeze({
            ...select,
            selections: select.selections
                ? freeze([...select.selections, ...selections])
                : freeze(selections),
        });
    },
    cloneWithDistinctOn(select, expressions) {
        return freeze({
            ...select,
            distinctOn: select.distinctOn
                ? freeze([...select.distinctOn, ...expressions])
                : freeze(expressions),
        });
    },
    cloneWithFrontModifier(select, modifier) {
        return freeze({
            ...select,
            frontModifiers: select.frontModifiers
                ? freeze([...select.frontModifiers, modifier])
                : freeze([modifier]),
        });
    },
    // TODO: remove in v0.29
    /**
     * @deprecated Use `QueryNode.cloneWithoutOrderBy` instead.
     */
    cloneWithOrderByItems: (node, items) => QueryNode.cloneWithOrderByItems(node, items),
    cloneWithGroupByItems(selectNode, items) {
        return freeze({
            ...selectNode,
            groupBy: selectNode.groupBy
                ? GroupByNode.cloneWithItems(selectNode.groupBy, items)
                : GroupByNode.create(items),
        });
    },
    cloneWithLimit(selectNode, limit) {
        return freeze({
            ...selectNode,
            limit,
        });
    },
    cloneWithOffset(selectNode, offset) {
        return freeze({
            ...selectNode,
            offset,
        });
    },
    cloneWithFetch(selectNode, fetch) {
        return freeze({
            ...selectNode,
            fetch,
        });
    },
    cloneWithHaving(selectNode, operation) {
        return freeze({
            ...selectNode,
            having: selectNode.having
                ? HavingNode.cloneWithOperation(selectNode.having, 'And', operation)
                : HavingNode.create(operation),
        });
    },
    cloneWithSetOperations(selectNode, setOperations) {
        return freeze({
            ...selectNode,
            setOperations: selectNode.setOperations
                ? freeze([...selectNode.setOperations, ...setOperations])
                : freeze([...setOperations]),
        });
    },
    cloneWithoutSelections(select) {
        return freeze({
            ...select,
            selections: [],
        });
    },
    cloneWithoutLimit(select) {
        return freeze({
            ...select,
            limit: undefined,
        });
    },
    cloneWithoutOffset(select) {
        return freeze({
            ...select,
            offset: undefined,
        });
    },
    // TODO: remove in v0.29
    /**
     * @deprecated Use `QueryNode.cloneWithoutOrderBy` instead.
     */
    cloneWithoutOrderBy: (node) => QueryNode.cloneWithoutOrderBy(node),
    cloneWithoutGroupBy(select) {
        return freeze({
            ...select,
            groupBy: undefined,
        });
    },
});
