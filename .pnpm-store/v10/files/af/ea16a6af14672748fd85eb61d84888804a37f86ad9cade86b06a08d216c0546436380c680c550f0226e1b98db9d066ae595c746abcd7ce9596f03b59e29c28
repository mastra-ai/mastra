/// <reference types="./values-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const ValuesNode = freeze({
    is(node) {
        return node.kind === 'ValuesNode';
    },
    create(values) {
        return freeze({
            kind: 'ValuesNode',
            values: freeze(values),
        });
    },
});
