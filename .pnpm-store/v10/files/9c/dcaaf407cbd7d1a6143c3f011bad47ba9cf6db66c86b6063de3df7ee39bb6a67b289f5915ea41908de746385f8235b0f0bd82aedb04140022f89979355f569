/// <reference types="./set-operation-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const SetOperationNode = freeze({
    is(node) {
        return node.kind === 'SetOperationNode';
    },
    create(operator, expression, all) {
        return freeze({
            kind: 'SetOperationNode',
            operator,
            expression,
            all,
        });
    },
});
