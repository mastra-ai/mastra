/// <reference types="./using-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const UsingNode = freeze({
    is(node) {
        return node.kind === 'UsingNode';
    },
    create(tables) {
        return freeze({
            kind: 'UsingNode',
            tables: freeze(tables),
        });
    },
    cloneWithTables(using, tables) {
        return freeze({
            ...using,
            tables: freeze([...using.tables, ...tables]),
        });
    },
});
