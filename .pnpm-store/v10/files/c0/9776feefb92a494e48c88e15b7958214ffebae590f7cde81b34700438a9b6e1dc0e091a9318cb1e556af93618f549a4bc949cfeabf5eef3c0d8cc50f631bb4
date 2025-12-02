"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropTableNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.DropTableNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'DropTableNode';
    },
    create(table, params) {
        return (0, object_utils_js_1.freeze)({
            kind: 'DropTableNode',
            table,
            ...params,
        });
    },
    cloneWith(dropIndex, params) {
        return (0, object_utils_js_1.freeze)({
            ...dropIndex,
            ...params,
        });
    },
});
