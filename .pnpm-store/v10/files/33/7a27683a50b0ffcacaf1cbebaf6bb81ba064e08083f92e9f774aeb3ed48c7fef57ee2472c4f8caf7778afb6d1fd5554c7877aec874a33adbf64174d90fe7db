"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TupleNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.TupleNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'TupleNode';
    },
    create(values) {
        return (0, object_utils_js_1.freeze)({
            kind: 'TupleNode',
            values: (0, object_utils_js_1.freeze)(values),
        });
    },
});
