"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropSchemaNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const identifier_node_js_1 = require("./identifier-node.js");
/**
 * @internal
 */
exports.DropSchemaNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'DropSchemaNode';
    },
    create(schema, params) {
        return (0, object_utils_js_1.freeze)({
            kind: 'DropSchemaNode',
            schema: identifier_node_js_1.IdentifierNode.create(schema),
            ...params,
        });
    },
    cloneWith(dropSchema, params) {
        return (0, object_utils_js_1.freeze)({
            ...dropSchema,
            ...params,
        });
    },
});
