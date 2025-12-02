/// <reference types="./primitive-value-list-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const PrimitiveValueListNode = freeze({
    is(node) {
        return node.kind === 'PrimitiveValueListNode';
    },
    create(values) {
        return freeze({
            kind: 'PrimitiveValueListNode',
            values: freeze([...values]),
        });
    },
});
