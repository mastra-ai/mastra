/// <reference types="./output-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const OutputNode = freeze({
    is(node) {
        return node.kind === 'OutputNode';
    },
    create(selections) {
        return freeze({
            kind: 'OutputNode',
            selections: freeze(selections),
        });
    },
    cloneWithSelections(output, selections) {
        return freeze({
            ...output,
            selections: output.selections
                ? freeze([...output.selections, ...selections])
                : freeze(selections),
        });
    },
});
