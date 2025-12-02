"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TopNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.TopNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'TopNode';
    },
    create(expression, modifiers) {
        return (0, object_utils_js_1.freeze)({
            kind: 'TopNode',
            expression,
            modifiers,
        });
    },
});
