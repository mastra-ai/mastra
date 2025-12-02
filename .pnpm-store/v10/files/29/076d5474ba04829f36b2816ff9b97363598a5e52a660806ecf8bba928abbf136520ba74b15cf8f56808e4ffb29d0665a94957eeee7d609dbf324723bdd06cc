/// <reference types="./common-table-expression-name-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { ColumnNode } from './column-node.js';
import { TableNode } from './table-node.js';
/**
 * @internal
 */
export const CommonTableExpressionNameNode = freeze({
    is(node) {
        return node.kind === 'CommonTableExpressionNameNode';
    },
    create(tableName, columnNames) {
        return freeze({
            kind: 'CommonTableExpressionNameNode',
            table: TableNode.create(tableName),
            columns: columnNames
                ? freeze(columnNames.map(ColumnNode.create))
                : undefined,
        });
    },
});
