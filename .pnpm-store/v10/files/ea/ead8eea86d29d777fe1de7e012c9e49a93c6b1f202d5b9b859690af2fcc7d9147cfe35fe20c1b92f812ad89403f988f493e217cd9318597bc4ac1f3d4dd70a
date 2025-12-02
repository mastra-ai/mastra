"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsertQueryNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.InsertQueryNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'InsertQueryNode';
    },
    create(into, withNode, replace) {
        return (0, object_utils_js_1.freeze)({
            kind: 'InsertQueryNode',
            into,
            ...(withNode && { with: withNode }),
            replace,
        });
    },
    createWithoutInto() {
        return (0, object_utils_js_1.freeze)({
            kind: 'InsertQueryNode',
        });
    },
    cloneWith(insertQuery, props) {
        return (0, object_utils_js_1.freeze)({
            ...insertQuery,
            ...props,
        });
    },
});
