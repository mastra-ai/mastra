"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultValueNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.DefaultValueNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'DefaultValueNode';
    },
    create(defaultValue) {
        return (0, object_utils_js_1.freeze)({
            kind: 'DefaultValueNode',
            defaultValue,
        });
    },
});
