"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupByNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.GroupByNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'GroupByNode';
    },
    create(items) {
        return (0, object_utils_js_1.freeze)({
            kind: 'GroupByNode',
            items: (0, object_utils_js_1.freeze)(items),
        });
    },
    cloneWithItems(groupBy, items) {
        return (0, object_utils_js_1.freeze)({
            ...groupBy,
            items: (0, object_utils_js_1.freeze)([...groupBy.items, ...items]),
        });
    },
});
