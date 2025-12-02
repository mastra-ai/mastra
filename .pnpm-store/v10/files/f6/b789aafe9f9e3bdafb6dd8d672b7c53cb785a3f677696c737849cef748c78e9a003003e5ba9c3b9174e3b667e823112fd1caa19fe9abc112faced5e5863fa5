/// <reference types="./explain-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const ExplainNode = freeze({
    is(node) {
        return node.kind === 'ExplainNode';
    },
    create(format, options) {
        return freeze({
            kind: 'ExplainNode',
            format,
            options,
        });
    },
});
