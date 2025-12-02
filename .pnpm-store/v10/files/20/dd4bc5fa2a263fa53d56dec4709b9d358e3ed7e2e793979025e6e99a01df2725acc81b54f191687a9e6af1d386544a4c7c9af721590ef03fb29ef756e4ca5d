"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderByNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.OrderByNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'OrderByNode';
    },
    create(items) {
        return (0, object_utils_js_1.freeze)({
            kind: 'OrderByNode',
            items: (0, object_utils_js_1.freeze)([...items]),
        });
    },
    cloneWithItems(orderBy, items) {
        return (0, object_utils_js_1.freeze)({
            ...orderBy,
            items: (0, object_utils_js_1.freeze)([...orderBy.items, ...items]),
        });
    },
});
