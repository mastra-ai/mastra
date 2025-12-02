/// <reference types="./fetch-node.d.ts" />
import { ValueNode } from './value-node.js';
/**
 * @internal
 */
export const FetchNode = {
    is(node) {
        return node.kind === 'FetchNode';
    },
    create(rowCount, modifier) {
        return {
            kind: 'FetchNode',
            rowCount: ValueNode.create(rowCount),
            modifier,
        };
    },
};
