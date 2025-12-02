/// <reference types="./table-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { SchemableIdentifierNode } from './schemable-identifier-node.js';
/**
 * @internal
 */
export const TableNode = freeze({
    is(node) {
        return node.kind === 'TableNode';
    },
    create(table) {
        return freeze({
            kind: 'TableNode',
            table: SchemableIdentifierNode.create(table),
        });
    },
    createWithSchema(schema, table) {
        return freeze({
            kind: 'TableNode',
            table: SchemableIdentifierNode.createWithSchema(schema, table),
        });
    },
});
