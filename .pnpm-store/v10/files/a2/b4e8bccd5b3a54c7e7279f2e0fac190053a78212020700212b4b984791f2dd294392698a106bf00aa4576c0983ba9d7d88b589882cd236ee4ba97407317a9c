"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonTableExpressionNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.CommonTableExpressionNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'CommonTableExpressionNode';
    },
    create(name, expression) {
        return (0, object_utils_js_1.freeze)({
            kind: 'CommonTableExpressionNode',
            name,
            expression,
        });
    },
    cloneWith(node, props) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            ...props,
        });
    },
});
