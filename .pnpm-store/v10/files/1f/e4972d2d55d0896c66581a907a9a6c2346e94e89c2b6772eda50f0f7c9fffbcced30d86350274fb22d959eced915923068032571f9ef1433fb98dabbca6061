/// <reference types="./tuple-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const TupleNode = freeze({
    is(node) {
        return node.kind === 'TupleNode';
    },
    create(values) {
        return freeze({
            kind: 'TupleNode',
            values: freeze(values),
        });
    },
});
