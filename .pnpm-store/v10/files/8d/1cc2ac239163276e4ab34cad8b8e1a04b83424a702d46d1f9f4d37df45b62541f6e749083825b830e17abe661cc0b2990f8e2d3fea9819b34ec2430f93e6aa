"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhenNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.WhenNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'WhenNode';
    },
    create(condition) {
        return (0, object_utils_js_1.freeze)({
            kind: 'WhenNode',
            condition,
        });
    },
    cloneWithResult(whenNode, result) {
        return (0, object_utils_js_1.freeze)({
            ...whenNode,
            result,
        });
    },
});
