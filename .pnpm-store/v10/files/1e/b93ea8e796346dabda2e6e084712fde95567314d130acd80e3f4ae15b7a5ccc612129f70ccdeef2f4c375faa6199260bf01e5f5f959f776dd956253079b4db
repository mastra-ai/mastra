"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropTypeNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.DropTypeNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'DropTypeNode';
    },
    create(name) {
        return (0, object_utils_js_1.freeze)({
            kind: 'DropTypeNode',
            name,
        });
    },
    cloneWith(dropType, params) {
        return (0, object_utils_js_1.freeze)({
            ...dropType,
            ...params,
        });
    },
});
