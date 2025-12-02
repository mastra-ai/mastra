/// <reference types="./create-table-node.d.ts" />
import { freeze } from '../util/object-utils.js';
export const ON_COMMIT_ACTIONS = ['preserve rows', 'delete rows', 'drop'];
/**
 * @internal
 */
export const CreateTableNode = freeze({
    is(node) {
        return node.kind === 'CreateTableNode';
    },
    create(table) {
        return freeze({
            kind: 'CreateTableNode',
            table,
            columns: freeze([]),
        });
    },
    cloneWithColumn(createTable, column) {
        return freeze({
            ...createTable,
            columns: freeze([...createTable.columns, column]),
        });
    },
    cloneWithConstraint(createTable, constraint) {
        return freeze({
            ...createTable,
            constraints: createTable.constraints
                ? freeze([...createTable.constraints, constraint])
                : freeze([constraint]),
        });
    },
    cloneWithFrontModifier(createTable, modifier) {
        return freeze({
            ...createTable,
            frontModifiers: createTable.frontModifiers
                ? freeze([...createTable.frontModifiers, modifier])
                : freeze([modifier]),
        });
    },
    cloneWithEndModifier(createTable, modifier) {
        return freeze({
            ...createTable,
            endModifiers: createTable.endModifiers
                ? freeze([...createTable.endModifiers, modifier])
                : freeze([modifier]),
        });
    },
    cloneWith(createTable, params) {
        return freeze({
            ...createTable,
            ...params,
        });
    },
});
