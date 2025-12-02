"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ColumnUpdateNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.ColumnUpdateNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'ColumnUpdateNode';
    },
    create(column, value) {
        return (0, object_utils_js_1.freeze)({
            kind: 'ColumnUpdateNode',
            column,
            value,
        });
    },
});
