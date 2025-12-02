"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const schemable_identifier_node_js_1 = require("./schemable-identifier-node.js");
/**
 * @internal
 */
exports.TableNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'TableNode';
    },
    create(table) {
        return (0, object_utils_js_1.freeze)({
            kind: 'TableNode',
            table: schemable_identifier_node_js_1.SchemableIdentifierNode.create(table),
        });
    },
    createWithSchema(schema, table) {
        return (0, object_utils_js_1.freeze)({
            kind: 'TableNode',
            table: schemable_identifier_node_js_1.SchemableIdentifierNode.createWithSchema(schema, table),
        });
    },
});
