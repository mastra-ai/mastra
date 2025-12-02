"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinaryOperationNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.BinaryOperationNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'BinaryOperationNode';
    },
    create(leftOperand, operator, rightOperand) {
        return (0, object_utils_js_1.freeze)({
            kind: 'BinaryOperationNode',
            leftOperand,
            operator,
            rightOperand,
        });
    },
});
