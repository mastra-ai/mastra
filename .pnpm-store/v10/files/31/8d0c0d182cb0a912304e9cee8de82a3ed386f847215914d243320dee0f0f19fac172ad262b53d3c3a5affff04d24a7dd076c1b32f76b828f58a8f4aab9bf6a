/// <reference types="./column-definition-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { ColumnNode } from './column-node.js';
/**
 * @internal
 */
export const ColumnDefinitionNode = freeze({
    is(node) {
        return node.kind === 'ColumnDefinitionNode';
    },
    create(column, dataType) {
        return freeze({
            kind: 'ColumnDefinitionNode',
            column: ColumnNode.create(column),
            dataType,
        });
    },
    cloneWithFrontModifier(node, modifier) {
        return freeze({
            ...node,
            frontModifiers: node.frontModifiers
                ? freeze([...node.frontModifiers, modifier])
                : [modifier],
        });
    },
    cloneWithEndModifier(node, modifier) {
        return freeze({
            ...node,
            endModifiers: node.endModifiers
                ? freeze([...node.endModifiers, modifier])
                : [modifier],
        });
    },
    cloneWith(node, props) {
        return freeze({
            ...node,
            ...props,
        });
    },
});
