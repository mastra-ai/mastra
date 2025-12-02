/// <reference types="./function-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const FunctionNode = freeze({
    is(node) {
        return node.kind === 'FunctionNode';
    },
    create(func, args) {
        return freeze({
            kind: 'FunctionNode',
            func,
            arguments: args,
        });
    },
});
