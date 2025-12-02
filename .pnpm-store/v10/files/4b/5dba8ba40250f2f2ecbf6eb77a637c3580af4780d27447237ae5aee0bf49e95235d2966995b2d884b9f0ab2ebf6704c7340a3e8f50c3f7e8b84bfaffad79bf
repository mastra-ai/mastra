/// <reference types="./collate-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { IdentifierNode } from './identifier-node.js';
/**
 * @internal
 */
export const CollateNode = {
    is(node) {
        return node.kind === 'CollateNode';
    },
    create(collation) {
        return freeze({
            kind: 'CollateNode',
            collation: IdentifierNode.create(collation),
        });
    },
};
