"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropIndexNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const schemable_identifier_node_js_1 = require("./schemable-identifier-node.js");
/**
 * @internal
 */
exports.DropIndexNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'DropIndexNode';
    },
    create(name, params) {
        return (0, object_utils_js_1.freeze)({
            kind: 'DropIndexNode',
            name: schemable_identifier_node_js_1.SchemableIdentifierNode.create(name),
            ...params,
        });
    },
    cloneWith(dropIndex, props) {
        return (0, object_utils_js_1.freeze)({
            ...dropIndex,
            ...props,
        });
    },
});
