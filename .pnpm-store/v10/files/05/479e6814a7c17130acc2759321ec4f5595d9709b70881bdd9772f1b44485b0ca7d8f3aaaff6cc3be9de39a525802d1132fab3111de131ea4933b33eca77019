"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemableIdentifierNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const identifier_node_js_1 = require("./identifier-node.js");
/**
 * @internal
 */
exports.SchemableIdentifierNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'SchemableIdentifierNode';
    },
    create(identifier) {
        return (0, object_utils_js_1.freeze)({
            kind: 'SchemableIdentifierNode',
            identifier: identifier_node_js_1.IdentifierNode.create(identifier),
        });
    },
    createWithSchema(schema, identifier) {
        return (0, object_utils_js_1.freeze)({
            kind: 'SchemableIdentifierNode',
            schema: identifier_node_js_1.IdentifierNode.create(schema),
            identifier: identifier_node_js_1.IdentifierNode.create(identifier),
        });
    },
});
