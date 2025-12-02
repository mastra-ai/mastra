/// <reference types="./matched-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const MatchedNode = freeze({
    is(node) {
        return node.kind === 'MatchedNode';
    },
    create(not, bySource = false) {
        return freeze({
            kind: 'MatchedNode',
            not,
            bySource,
        });
    },
});
