/// <reference types="./from-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const FromNode = freeze({
    is(node) {
        return node.kind === 'FromNode';
    },
    create(froms) {
        return freeze({
            kind: 'FromNode',
            froms: freeze(froms),
        });
    },
    cloneWithFroms(from, froms) {
        return freeze({
            ...from,
            froms: freeze([...from.froms, ...froms]),
        });
    },
});
