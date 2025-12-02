/// <reference types="./drop-schema-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { IdentifierNode } from './identifier-node.js';
/**
 * @internal
 */
export const DropSchemaNode = freeze({
    is(node) {
        return node.kind === 'DropSchemaNode';
    },
    create(schema, params) {
        return freeze({
            kind: 'DropSchemaNode',
            schema: IdentifierNode.create(schema),
            ...params,
        });
    },
    cloneWith(dropSchema, params) {
        return freeze({
            ...dropSchema,
            ...params,
        });
    },
});
