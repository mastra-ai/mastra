"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartitionByNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.PartitionByNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'PartitionByNode';
    },
    create(items) {
        return (0, object_utils_js_1.freeze)({
            kind: 'PartitionByNode',
            items: (0, object_utils_js_1.freeze)(items),
        });
    },
    cloneWithItems(partitionBy, items) {
        return (0, object_utils_js_1.freeze)({
            ...partitionBy,
            items: (0, object_utils_js_1.freeze)([...partitionBy.items, ...items]),
        });
    },
});
