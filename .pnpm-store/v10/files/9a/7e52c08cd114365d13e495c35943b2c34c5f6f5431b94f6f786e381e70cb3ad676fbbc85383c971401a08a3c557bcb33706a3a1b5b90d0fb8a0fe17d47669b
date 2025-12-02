/// <reference types="./add-index-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { IdentifierNode } from './identifier-node.js';
/**
 * @internal
 */
export const AddIndexNode = freeze({
    is(node) {
        return node.kind === 'AddIndexNode';
    },
    create(name) {
        return freeze({
            kind: 'AddIndexNode',
            name: IdentifierNode.create(name),
        });
    },
    cloneWith(node, props) {
        return freeze({
            ...node,
            ...props,
        });
    },
    cloneWithColumns(node, columns) {
        return freeze({
            ...node,
            columns: [...(node.columns || []), ...columns],
        });
    },
});
