/// <reference types="./raw-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const RawNode = freeze({
    is(node) {
        return node.kind === 'RawNode';
    },
    create(sqlFragments, parameters) {
        return freeze({
            kind: 'RawNode',
            sqlFragments: freeze(sqlFragments),
            parameters: freeze(parameters),
        });
    },
    createWithSql(sql) {
        return RawNode.create([sql], []);
    },
    createWithChild(child) {
        return RawNode.create(['', ''], [child]);
    },
    createWithChildren(children) {
        return RawNode.create(new Array(children.length + 1).fill(''), children);
    },
});
