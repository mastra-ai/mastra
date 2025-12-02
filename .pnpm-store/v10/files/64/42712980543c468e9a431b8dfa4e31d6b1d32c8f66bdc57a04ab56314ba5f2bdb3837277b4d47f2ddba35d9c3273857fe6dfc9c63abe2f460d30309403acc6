/// <reference types="./drop-table-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const DropTableNode = freeze({
    is(node) {
        return node.kind === 'DropTableNode';
    },
    create(table, params) {
        return freeze({
            kind: 'DropTableNode',
            table,
            ...params,
        });
    },
    cloneWith(dropIndex, params) {
        return freeze({
            ...dropIndex,
            ...params,
        });
    },
});
