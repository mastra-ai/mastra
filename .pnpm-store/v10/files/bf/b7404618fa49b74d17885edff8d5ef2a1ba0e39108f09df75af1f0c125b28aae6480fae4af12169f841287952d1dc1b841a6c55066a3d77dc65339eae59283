/// <reference types="./drop-view-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { SchemableIdentifierNode } from './schemable-identifier-node.js';
/**
 * @internal
 */
export const DropViewNode = freeze({
    is(node) {
        return node.kind === 'DropViewNode';
    },
    create(name) {
        return freeze({
            kind: 'DropViewNode',
            name: SchemableIdentifierNode.create(name),
        });
    },
    cloneWith(dropView, params) {
        return freeze({
            ...dropView,
            ...params,
        });
    },
});
