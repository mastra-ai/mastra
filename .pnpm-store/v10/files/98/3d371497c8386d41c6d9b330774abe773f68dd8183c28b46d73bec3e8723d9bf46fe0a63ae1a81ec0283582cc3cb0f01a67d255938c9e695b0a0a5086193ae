"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ColumnDefinitionNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const column_node_js_1 = require("./column-node.js");
/**
 * @internal
 */
exports.ColumnDefinitionNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'ColumnDefinitionNode';
    },
    create(column, dataType) {
        return (0, object_utils_js_1.freeze)({
            kind: 'ColumnDefinitionNode',
            column: column_node_js_1.ColumnNode.create(column),
            dataType,
        });
    },
    cloneWithFrontModifier(node, modifier) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            frontModifiers: node.frontModifiers
                ? (0, object_utils_js_1.freeze)([...node.frontModifiers, modifier])
                : [modifier],
        });
    },
    cloneWithEndModifier(node, modifier) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            endModifiers: node.endModifiers
                ? (0, object_utils_js_1.freeze)([...node.endModifiers, modifier])
                : [modifier],
        });
    },
    cloneWith(node, props) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            ...props,
        });
    },
});
