"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenameConstraintNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const identifier_node_js_1 = require("./identifier-node.js");
/**
 * @internal
 */
exports.RenameConstraintNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'RenameConstraintNode';
    },
    create(oldName, newName) {
        return (0, object_utils_js_1.freeze)({
            kind: 'RenameConstraintNode',
            oldName: identifier_node_js_1.IdentifierNode.create(oldName),
            newName: identifier_node_js_1.IdentifierNode.create(newName),
        });
    },
});
