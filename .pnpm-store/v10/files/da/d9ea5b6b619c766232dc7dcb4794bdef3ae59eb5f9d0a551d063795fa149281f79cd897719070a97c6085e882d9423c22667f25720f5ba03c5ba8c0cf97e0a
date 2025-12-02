"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlterTableNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.AlterTableNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'AlterTableNode';
    },
    create(table) {
        return (0, object_utils_js_1.freeze)({
            kind: 'AlterTableNode',
            table,
        });
    },
    cloneWithTableProps(node, props) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            ...props,
        });
    },
    cloneWithColumnAlteration(node, columnAlteration) {
        return (0, object_utils_js_1.freeze)({
            ...node,
            columnAlterations: node.columnAlterations
                ? [...node.columnAlterations, columnAlteration]
                : [columnAlteration],
        });
    },
});
