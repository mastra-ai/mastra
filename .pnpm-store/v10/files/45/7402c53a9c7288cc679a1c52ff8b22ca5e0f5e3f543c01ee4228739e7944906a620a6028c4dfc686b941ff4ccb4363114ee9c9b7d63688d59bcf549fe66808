"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValueNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.ValueNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'ValueNode';
    },
    create(value) {
        return (0, object_utils_js_1.freeze)({
            kind: 'ValueNode',
            value,
        });
    },
    createImmediate(value) {
        return (0, object_utils_js_1.freeze)({
            kind: 'ValueNode',
            value,
            immediate: true,
        });
    },
});
