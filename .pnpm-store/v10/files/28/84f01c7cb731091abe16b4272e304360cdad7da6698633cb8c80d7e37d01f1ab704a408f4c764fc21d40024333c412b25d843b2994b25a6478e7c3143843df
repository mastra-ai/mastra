"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CastNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.CastNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'CastNode';
    },
    create(expression, dataType) {
        return (0, object_utils_js_1.freeze)({
            kind: 'CastNode',
            expression,
            dataType,
        });
    },
});
