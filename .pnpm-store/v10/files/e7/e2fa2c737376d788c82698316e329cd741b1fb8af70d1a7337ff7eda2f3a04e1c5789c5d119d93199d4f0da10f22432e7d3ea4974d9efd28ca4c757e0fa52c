"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForeignKeyConstraintNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const identifier_node_js_1 = require("./identifier-node.js");
const references_node_js_1 = require("./references-node.js");
/**
 * @internal
 */
exports.ForeignKeyConstraintNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'ForeignKeyConstraintNode';
    },
    create(sourceColumns, targetTable, targetColumns, constraintName) {
        return (0, object_utils_js_1.freeze)({
            kind: 'ForeignKeyConstraintNode',
            columns: sourceColumns,
            references: references_node_js_1.ReferencesNode.create(targetTable, targetColumns),
            name: constraintName ? identifier_node_js_1.IdentifierNode.create(constraintName) : undefined,
        });
    },
    cloneWith(node, props) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            ...props,
        });
    },
});
