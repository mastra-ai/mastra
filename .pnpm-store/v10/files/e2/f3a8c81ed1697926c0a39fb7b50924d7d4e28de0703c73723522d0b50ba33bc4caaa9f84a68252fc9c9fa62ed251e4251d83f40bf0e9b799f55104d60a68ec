"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectModifierNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.SelectModifierNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'SelectModifierNode';
    },
    create(modifier, of) {
        return (0, object_utils_js_1.freeze)({
            kind: 'SelectModifierNode',
            modifier,
            of,
        });
    },
    createWithExpression(modifier) {
        return (0, object_utils_js_1.freeze)({
            kind: 'SelectModifierNode',
            rawModifier: modifier,
        });
    },
});
