"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONOperatorChainNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.JSONOperatorChainNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'JSONOperatorChainNode';
    },
    create(operator) {
        return (0, object_utils_js_1.freeze)({
            kind: 'JSONOperatorChainNode',
            operator,
            values: (0, object_utils_js_1.freeze)([]),
        });
    },
    cloneWithValue(node, value) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            values: (0, object_utils_js_1.freeze)([...node.values, value]),
        });
    },
});
