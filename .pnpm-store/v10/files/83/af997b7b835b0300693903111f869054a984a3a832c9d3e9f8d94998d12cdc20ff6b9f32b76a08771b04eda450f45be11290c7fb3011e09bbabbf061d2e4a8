"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropConstraintNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const identifier_node_js_1 = require("./identifier-node.js");
/**
 * @internal
 */
exports.DropConstraintNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'DropConstraintNode';
    },
    create(constraintName) {
        return (0, object_utils_js_1.freeze)({
            kind: 'DropConstraintNode',
            constraintName: identifier_node_js_1.IdentifierNode.create(constraintName),
        });
    },
    cloneWith(dropConstraint, props) {
        return (0, object_utils_js_1.freeze)({
            ...dropConstraint,
            ...props,
        });
    },
});
