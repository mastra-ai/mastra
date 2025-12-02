/// <reference types="./default-value-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const DefaultValueNode = freeze({
    is(node) {
        return node.kind === 'DefaultValueNode';
    },
    create(defaultValue) {
        return freeze({
            kind: 'DefaultValueNode',
            defaultValue,
        });
    },
});
