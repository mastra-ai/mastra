"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSchemaNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const identifier_node_js_1 = require("./identifier-node.js");
/**
 * @internal
 */
exports.CreateSchemaNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'CreateSchemaNode';
    },
    create(schema, params) {
        return (0, object_utils_js_1.freeze)({
            kind: 'CreateSchemaNode',
            schema: identifier_node_js_1.IdentifierNode.create(schema),
            ...params,
        });
    },
    cloneWith(createSchema, params) {
        return (0, object_utils_js_1.freeze)({
            ...createSchema,
            ...params,
        });
    },
});
