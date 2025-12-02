"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AndNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.AndNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'AndNode';
    },
    create(left, right) {
        return (0, object_utils_js_1.freeze)({
            kind: 'AndNode',
            left,
            right,
        });
    },
});
