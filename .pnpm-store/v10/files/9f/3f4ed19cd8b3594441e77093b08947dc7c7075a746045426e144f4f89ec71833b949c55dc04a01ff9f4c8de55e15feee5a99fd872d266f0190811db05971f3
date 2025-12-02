/// <reference types="./merge-query-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { WhenNode } from './when-node.js';
/**
 * @internal
 */
export const MergeQueryNode = freeze({
    is(node) {
        return node.kind === 'MergeQueryNode';
    },
    create(into, withNode) {
        return freeze({
            kind: 'MergeQueryNode',
            into,
            ...(withNode && { with: withNode }),
        });
    },
    cloneWithUsing(mergeNode, using) {
        return freeze({
            ...mergeNode,
            using,
        });
    },
    cloneWithWhen(mergeNode, when) {
        return freeze({
            ...mergeNode,
            whens: mergeNode.whens
                ? freeze([...mergeNode.whens, when])
                : freeze([when]),
        });
    },
    cloneWithThen(mergeNode, then) {
        return freeze({
            ...mergeNode,
            whens: mergeNode.whens
                ? freeze([
                    ...mergeNode.whens.slice(0, -1),
                    WhenNode.cloneWithResult(mergeNode.whens[mergeNode.whens.length - 1], then),
                ])
                : undefined,
        });
    },
});
