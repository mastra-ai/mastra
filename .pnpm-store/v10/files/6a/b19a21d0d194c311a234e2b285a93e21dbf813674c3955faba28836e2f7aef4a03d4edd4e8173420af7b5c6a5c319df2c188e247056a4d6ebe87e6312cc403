"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.OrNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'OrNode';
    },
    create(left, right) {
        return (0, object_utils_js_1.freeze)({
            kind: 'OrNode',
            left,
            right,
        });
    },
});
