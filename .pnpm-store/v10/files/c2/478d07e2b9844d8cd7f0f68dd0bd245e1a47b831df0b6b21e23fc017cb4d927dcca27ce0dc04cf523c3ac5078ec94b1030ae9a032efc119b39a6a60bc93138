"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeneratedNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.GeneratedNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'GeneratedNode';
    },
    create(params) {
        return (0, object_utils_js_1.freeze)({
            kind: 'GeneratedNode',
            ...params,
        });
    },
    createWithExpression(expression) {
        return (0, object_utils_js_1.freeze)({
            kind: 'GeneratedNode',
            always: true,
            expression,
        });
    },
    cloneWith(node, params) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            ...params,
        });
    },
});
