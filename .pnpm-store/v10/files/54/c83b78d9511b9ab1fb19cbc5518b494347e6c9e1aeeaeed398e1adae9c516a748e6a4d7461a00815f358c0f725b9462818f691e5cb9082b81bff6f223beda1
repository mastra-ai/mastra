/// <reference types="./create-view-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { SchemableIdentifierNode } from './schemable-identifier-node.js';
/**
 * @internal
 */
export const CreateViewNode = freeze({
    is(node) {
        return node.kind === 'CreateViewNode';
    },
    create(name) {
        return freeze({
            kind: 'CreateViewNode',
            name: SchemableIdentifierNode.create(name),
        });
    },
    cloneWith(createView, params) {
        return freeze({
            ...createView,
            ...params,
        });
    },
});
