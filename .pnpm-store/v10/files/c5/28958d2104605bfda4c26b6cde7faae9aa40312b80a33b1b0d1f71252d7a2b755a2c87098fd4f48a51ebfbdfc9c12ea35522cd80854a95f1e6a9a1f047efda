/// <reference types="./on-duplicate-key-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const OnDuplicateKeyNode = freeze({
    is(node) {
        return node.kind === 'OnDuplicateKeyNode';
    },
    create(updates) {
        return freeze({
            kind: 'OnDuplicateKeyNode',
            updates,
        });
    },
});
