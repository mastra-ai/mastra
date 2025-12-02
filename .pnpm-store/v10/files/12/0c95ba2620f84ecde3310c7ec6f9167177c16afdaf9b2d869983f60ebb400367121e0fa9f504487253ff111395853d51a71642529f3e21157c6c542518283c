"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnaryOperationNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.UnaryOperationNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'UnaryOperationNode';
    },
    create(operator, operand) {
        return (0, object_utils_js_1.freeze)({
            kind: 'UnaryOperationNode',
            operator,
            operand,
        });
    },
});
