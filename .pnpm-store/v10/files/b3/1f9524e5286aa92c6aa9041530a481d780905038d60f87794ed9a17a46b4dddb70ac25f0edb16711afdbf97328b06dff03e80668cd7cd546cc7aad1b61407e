/// <reference types="./create-index-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { IdentifierNode } from './identifier-node.js';
/**
 * @internal
 */
export const CreateIndexNode = freeze({
    is(node) {
        return node.kind === 'CreateIndexNode';
    },
    create(name) {
        return freeze({
            kind: 'CreateIndexNode',
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
