/// <reference types="./alter-table-node.d.ts" />
import { freeze } from '../util/object-utils.js';
/**
 * @internal
 */
export const AlterTableNode = freeze({
    is(node) {
        return node.kind === 'AlterTableNode';
    },
    create(table) {
        return freeze({
            kind: 'AlterTableNode',
            table,
        });
    },
    cloneWithTableProps(node, props) {
        return freeze({
            ...node,
            ...props,
        });
    },
    cloneWithColumnAlteration(node, columnAlteration) {
        return freeze({
            ...node,
            columnAlterations: node.columnAlterations
                ? [...node.columnAlterations, columnAlteration]
                : [columnAlteration],
        });
    },
});
