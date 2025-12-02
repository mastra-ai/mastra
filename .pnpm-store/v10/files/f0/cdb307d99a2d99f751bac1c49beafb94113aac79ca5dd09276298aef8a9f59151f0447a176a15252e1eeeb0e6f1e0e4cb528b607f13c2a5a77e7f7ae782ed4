"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectionNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const reference_node_js_1 = require("./reference-node.js");
const select_all_node_js_1 = require("./select-all-node.js");
/**
 * @internal
 */
exports.SelectionNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'SelectionNode';
    },
    create(selection) {
        return (0, object_utils_js_1.freeze)({
            kind: 'SelectionNode',
            selection: selection,
        });
    },
    createSelectAll() {
        return (0, object_utils_js_1.freeze)({
            kind: 'SelectionNode',
            selection: select_all_node_js_1.SelectAllNode.create(),
        });
    },
    createSelectAllFromTable(table) {
        return (0, object_utils_js_1.freeze)({
            kind: 'SelectionNode',
            selection: reference_node_js_1.ReferenceNode.createSelectAll(table),
        });
    },
});
