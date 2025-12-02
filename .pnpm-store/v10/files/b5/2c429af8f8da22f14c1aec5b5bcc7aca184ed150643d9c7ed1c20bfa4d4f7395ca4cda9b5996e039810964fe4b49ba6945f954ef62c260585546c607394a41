/// <reference types="./returning-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const ReturningNode = freeze({
    is(node) {
        return node.kind === 'ReturningNode';
    },
    create(selections) {
        return freeze({
            kind: 'ReturningNode',
            selections: freeze(selections),
        });
    },
    cloneWithSelections(returning, selections) {
        return freeze({
            ...returning,
            selections: returning.selections
                ? freeze([...returning.selections, ...selections])
                : freeze(selections),
        });
    },
});
