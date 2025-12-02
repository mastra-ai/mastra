"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimaryConstraintNode = exports.PrimaryKeyConstraintNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const column_node_js_1 = require("./column-node.js");
const identifier_node_js_1 = require("./identifier-node.js");
/**
 * @internal
 */
exports.PrimaryKeyConstraintNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'PrimaryKeyConstraintNode';
    },
    create(columns, constraintName) {
        return (0, object_utils_js_1.freeze)({
            kind: 'PrimaryKeyConstraintNode',
            columns: (0, object_utils_js_1.freeze)(columns.map(column_node_js_1.ColumnNode.create)),
            name: constraintName ? identifier_node_js_1.IdentifierNode.create(constraintName) : undefined,
        });
    },
    cloneWith(node, props) {
        return (0, object_utils_js_1.freeze)({ ...node, ...props });
    },
});
/**
 * Backwards compatibility for a typo in the codebase.
 *
 * @deprecated Use {@link PrimaryKeyConstraintNode} instead.
 */
exports.PrimaryConstraintNode = exports.PrimaryKeyConstraintNode;
