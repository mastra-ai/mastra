"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniqueConstraintNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const column_node_js_1 = require("./column-node.js");
const identifier_node_js_1 = require("./identifier-node.js");
/**
 * @internal
 */
exports.UniqueConstraintNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'UniqueConstraintNode';
    },
    create(columns, constraintName, nullsNotDistinct) {
        return (0, object_utils_js_1.freeze)({
            kind: 'UniqueConstraintNode',
            columns: (0, object_utils_js_1.freeze)(columns.map(column_node_js_1.ColumnNode.create)),
            name: constraintName ? identifier_node_js_1.IdentifierNode.create(constraintName) : undefined,
            nullsNotDistinct,
        });
    },
    cloneWith(node, props) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            ...props,
        });
    },
});
