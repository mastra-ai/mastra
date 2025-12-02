"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.WithNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'WithNode';
    },
    create(expression, params) {
        return (0, object_utils_js_1.freeze)({
            kind: 'WithNode',
            expressions: (0, object_utils_js_1.freeze)([expression]),
            ...params,
        });
    },
    cloneWithExpression(withNode, expression) {
        return (0, object_utils_js_1.freeze)({
            ...withNode,
            expressions: (0, object_utils_js_1.freeze)([...withNode.expressions, expression]),
        });
    },
});
