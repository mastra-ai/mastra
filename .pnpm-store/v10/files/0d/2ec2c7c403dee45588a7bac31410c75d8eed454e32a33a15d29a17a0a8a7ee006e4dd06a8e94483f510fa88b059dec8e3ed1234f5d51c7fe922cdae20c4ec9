"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferencesNode = exports.ON_MODIFY_FOREIGN_ACTIONS = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
exports.ON_MODIFY_FOREIGN_ACTIONS = [
    'no action',
    'restrict',
    'cascade',
    'set null',
    'set default',
];
/**
 * @internal
 */
exports.ReferencesNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'ReferencesNode';
    },
    create(table, columns) {
        return (0, object_utils_js_1.freeze)({
            kind: 'ReferencesNode',
            table,
            columns: (0, object_utils_js_1.freeze)([...columns]),
        });
    },
    cloneWithOnDelete(references, onDelete) {
        return (0, object_utils_js_1.freeze)({
            ...references,
            onDelete,
        });
    },
    cloneWithOnUpdate(references, onUpdate) {
        return (0, object_utils_js_1.freeze)({
            ...references,
            onUpdate,
        });
    },
});
