"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollateNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const identifier_node_js_1 = require("./identifier-node.js");
/**
 * @internal
 */
exports.CollateNode = {
    is(node) {
        return node.kind === 'CollateNode';
    },
    create(collation) {
        return (0, object_utils_js_1.freeze)({
            kind: 'CollateNode',
            collation: identifier_node_js_1.IdentifierNode.create(collation),
        });
    },
};
