"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateViewNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const schemable_identifier_node_js_1 = require("./schemable-identifier-node.js");
/**
 * @internal
 */
exports.CreateViewNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'CreateViewNode';
    },
    create(name) {
        return (0, object_utils_js_1.freeze)({
            kind: 'CreateViewNode',
            name: schemable_identifier_node_js_1.SchemableIdentifierNode.create(name),
        });
    },
    cloneWith(createView, params) {
        return (0, object_utils_js_1.freeze)({
            ...createView,
            ...params,
        });
    },
});
