/// <reference types="./create-type-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { ValueListNode } from './value-list-node.js';
import { ValueNode } from './value-node.js';
/**
 * @internal
 */
export const CreateTypeNode = freeze({
    is(node) {
        return node.kind === 'CreateTypeNode';
    },
    create(name) {
        return freeze({
            kind: 'CreateTypeNode',
            name,
        });
    },
    cloneWithEnum(createType, values) {
        return freeze({
            ...createType,
            enum: ValueListNode.create(values.map(ValueNode.createImmediate)),
        });
    },
});
