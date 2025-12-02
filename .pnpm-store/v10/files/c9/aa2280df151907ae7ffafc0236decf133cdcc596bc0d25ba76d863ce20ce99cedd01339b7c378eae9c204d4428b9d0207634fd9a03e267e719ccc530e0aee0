/// <reference types="./drop-index-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { SchemableIdentifierNode } from './schemable-identifier-node.js';
/**
 * @internal
 */
export const DropIndexNode = freeze({
    is(node) {
        return node.kind === 'DropIndexNode';
    },
    create(name, params) {
        return freeze({
            kind: 'DropIndexNode',
            name: SchemableIdentifierNode.create(name),
            ...params,
        });
    },
    cloneWith(dropIndex, props) {
        return freeze({
            ...dropIndex,
            ...props,
        });
    },
});
