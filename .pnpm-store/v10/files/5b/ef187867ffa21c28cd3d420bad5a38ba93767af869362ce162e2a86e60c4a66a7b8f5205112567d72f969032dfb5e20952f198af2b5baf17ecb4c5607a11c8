"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshMaterializedViewNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const schemable_identifier_node_js_1 = require("./schemable-identifier-node.js");
/**
 * @internal
 */
exports.RefreshMaterializedViewNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'RefreshMaterializedViewNode';
    },
    create(name) {
        return (0, object_utils_js_1.freeze)({
            kind: 'RefreshMaterializedViewNode',
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
