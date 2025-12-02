"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.ListNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'ListNode';
    },
    create(items) {
        return (0, object_utils_js_1.freeze)({
            kind: 'ListNode',
            items: (0, object_utils_js_1.freeze)(items),
        });
    },
});
