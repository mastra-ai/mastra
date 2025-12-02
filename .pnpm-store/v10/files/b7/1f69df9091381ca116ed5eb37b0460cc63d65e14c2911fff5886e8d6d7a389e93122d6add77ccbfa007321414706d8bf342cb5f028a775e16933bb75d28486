/// <reference types="./json-operator-chain-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const JSONOperatorChainNode = freeze({
    is(node) {
        return node.kind === 'JSONOperatorChainNode';
    },
    create(operator) {
        return freeze({
            kind: 'JSONOperatorChainNode',
            operator,
            values: freeze([]),
        });
    },
    cloneWithValue(node, value) {
        return freeze({
            ...node,
            values: freeze([...node.values, value]),
        });
    },
});
