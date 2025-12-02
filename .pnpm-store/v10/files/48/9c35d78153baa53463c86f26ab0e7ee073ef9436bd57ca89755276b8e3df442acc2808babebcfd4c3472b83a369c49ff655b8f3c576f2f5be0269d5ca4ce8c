/// <reference types="./drop-type-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const DropTypeNode = freeze({
    is(node) {
        return node.kind === 'DropTypeNode';
    },
    create(name) {
        return freeze({
            kind: 'DropTypeNode',
            name,
        });
    },
    cloneWith(dropType, params) {
        return freeze({
            ...dropType,
            ...params,
        });
    },
});
