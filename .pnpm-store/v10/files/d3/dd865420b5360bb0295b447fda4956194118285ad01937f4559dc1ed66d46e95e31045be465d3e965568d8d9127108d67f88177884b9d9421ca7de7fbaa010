"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferenceNode = void 0;
const select_all_node_js_1 = require("./select-all-node.js");
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.ReferenceNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'ReferenceNode';
    },
    create(column, table) {
        return (0, object_utils_js_1.freeze)({
            kind: 'ReferenceNode',
            table,
            column,
        });
    },
    createSelectAll(table) {
        return (0, object_utils_js_1.freeze)({
            kind: 'ReferenceNode',
            table,
            column: select_all_node_js_1.SelectAllNode.create(),
        });
    },
});
