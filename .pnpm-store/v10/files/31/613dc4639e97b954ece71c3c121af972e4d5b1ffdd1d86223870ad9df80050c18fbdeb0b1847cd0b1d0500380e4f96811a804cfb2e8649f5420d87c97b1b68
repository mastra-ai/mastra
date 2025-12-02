/// <reference types="./insert-query-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const InsertQueryNode = freeze({
    is(node) {
        return node.kind === 'InsertQueryNode';
    },
    create(into, withNode, replace) {
        return freeze({
            kind: 'InsertQueryNode',
            into,
            ...(withNode && { with: withNode }),
            replace,
        });
    },
    createWithoutInto() {
        return freeze({
            kind: 'InsertQueryNode',
        });
    },
    cloneWith(insertQuery, props) {
        return freeze({
            ...insertQuery,
            ...props,
        });
    },
});
