/// <reference types="./create-schema-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { IdentifierNode } from './identifier-node.js';
/**
 * @internal
 */
export const CreateSchemaNode = freeze({
    is(node) {
        return node.kind === 'CreateSchemaNode';
    },
    create(schema, params) {
        return freeze({
            kind: 'CreateSchemaNode',
            schema: IdentifierNode.create(schema),
            ...params,
        });
    },
    cloneWith(createSchema, params) {
        return freeze({
            ...createSchema,
            ...params,
        });
    },
});
