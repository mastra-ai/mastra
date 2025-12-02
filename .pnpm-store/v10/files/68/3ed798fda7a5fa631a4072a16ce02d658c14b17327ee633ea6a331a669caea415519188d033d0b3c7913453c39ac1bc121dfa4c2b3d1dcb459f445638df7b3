"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AliasNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.AliasNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'AliasNode';
    },
    create(node, alias) {
        return (0, object_utils_js_1.freeze)({
            kind: 'AliasNode',
            node,
            alias,
        });
    },
});
