/// <reference types="./refresh-materialized-view-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { SchemableIdentifierNode } from './schemable-identifier-node.js';
/**
 * @internal
 */
export const RefreshMaterializedViewNode = freeze({
    is(node) {
        return node.kind === 'RefreshMaterializedViewNode';
    },
    create(name) {
        return freeze({
            kind: 'RefreshMaterializedViewNode',
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
