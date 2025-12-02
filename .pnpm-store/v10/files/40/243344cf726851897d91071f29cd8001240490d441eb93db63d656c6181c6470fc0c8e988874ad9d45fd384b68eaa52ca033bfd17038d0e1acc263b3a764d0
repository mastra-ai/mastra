/// <reference types="./schemable-identifier-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { IdentifierNode } from './identifier-node.js';
/**
 * @internal
 */
export const SchemableIdentifierNode = freeze({
    is(node) {
        return node.kind === 'SchemableIdentifierNode';
    },
    create(identifier) {
        return freeze({
            kind: 'SchemableIdentifierNode',
            identifier: IdentifierNode.create(identifier),
        });
    },
    createWithSchema(schema, identifier) {
        return freeze({
            kind: 'SchemableIdentifierNode',
            schema: IdentifierNode.create(schema),
            identifier: IdentifierNode.create(identifier),
        });
    },
});
