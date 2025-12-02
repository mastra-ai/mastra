/// <reference types="./alias-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const AliasNode = freeze({
    is(node) {
        return node.kind === 'AliasNode';
    },
    create(node, alias) {
        return freeze({
            kind: 'AliasNode',
            node,
            alias,
        });
    },
});
