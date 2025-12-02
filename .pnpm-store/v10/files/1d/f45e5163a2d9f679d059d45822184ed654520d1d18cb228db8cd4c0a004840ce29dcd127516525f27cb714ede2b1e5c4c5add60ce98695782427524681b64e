/// <reference types="./json-path-leg-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const JSONPathLegNode = freeze({
    is(node) {
        return node.kind === 'JSONPathLegNode';
    },
    create(type, value) {
        return freeze({
            kind: 'JSONPathLegNode',
            type,
            value,
        });
    },
});
