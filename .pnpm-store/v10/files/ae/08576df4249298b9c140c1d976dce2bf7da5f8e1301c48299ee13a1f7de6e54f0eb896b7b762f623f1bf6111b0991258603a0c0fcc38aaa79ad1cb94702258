"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckConstraintNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const identifier_node_js_1 = require("./identifier-node.js");
/**
 * @internal
 */
exports.CheckConstraintNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'CheckConstraintNode';
    },
    create(expression, constraintName) {
        return (0, object_utils_js_1.freeze)({
            kind: 'CheckConstraintNode',
            expression,
            name: constraintName ? identifier_node_js_1.IdentifierNode.create(constraintName) : undefined,
        });
    },
});
