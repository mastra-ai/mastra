/// <reference types="./identifier-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const IdentifierNode = freeze({
    is(node) {
        return node.kind === 'IdentifierNode';
    },
    create(name) {
        return freeze({
            kind: 'IdentifierNode',
            name,
        });
    },
});
