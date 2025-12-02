"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunctionNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.FunctionNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'FunctionNode';
    },
    create(func, args) {
        return (0, object_utils_js_1.freeze)({
            kind: 'FunctionNode',
            func,
            arguments: args,
        });
    },
});
