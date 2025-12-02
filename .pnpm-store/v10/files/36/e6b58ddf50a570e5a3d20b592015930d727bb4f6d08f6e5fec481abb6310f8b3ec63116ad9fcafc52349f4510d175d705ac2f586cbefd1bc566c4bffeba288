/// <reference types="./cast-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const CastNode = freeze({
    is(node) {
        return node.kind === 'CastNode';
    },
    create(expression, dataType) {
        return freeze({
            kind: 'CastNode',
            expression,
            dataType,
        });
    },
});
