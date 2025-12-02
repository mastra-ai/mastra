"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimitiveValueListNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.PrimitiveValueListNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'PrimitiveValueListNode';
    },
    create(values) {
        return (0, object_utils_js_1.freeze)({
            kind: 'PrimitiveValueListNode',
            values: (0, object_utils_js_1.freeze)([...values]),
        });
    },
});
