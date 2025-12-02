"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValueListNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.ValueListNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'ValueListNode';
    },
    create(values) {
        return (0, object_utils_js_1.freeze)({
            kind: 'ValueListNode',
            values: (0, object_utils_js_1.freeze)(values),
        });
    },
});
