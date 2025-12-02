"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValuesNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.ValuesNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'ValuesNode';
    },
    create(values) {
        return (0, object_utils_js_1.freeze)({
            kind: 'ValuesNode',
            values: (0, object_utils_js_1.freeze)(values),
        });
    },
});
