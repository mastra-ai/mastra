"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateTypeNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const value_list_node_js_1 = require("./value-list-node.js");
const value_node_js_1 = require("./value-node.js");
/**
 * @internal
 */
exports.CreateTypeNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'CreateTypeNode';
    },
    create(name) {
        return (0, object_utils_js_1.freeze)({
            kind: 'CreateTypeNode',
            name,
        });
    },
    cloneWithEnum(createType, values) {
        return (0, object_utils_js_1.freeze)({
            ...createType,
            enum: value_list_node_js_1.ValueListNode.create(values.map(value_node_js_1.ValueNode.createImmediate)),
        });
    },
});
