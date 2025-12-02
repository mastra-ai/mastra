"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateTableNode = exports.ON_COMMIT_ACTIONS = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
exports.ON_COMMIT_ACTIONS = ['preserve rows', 'delete rows', 'drop'];
/**
 * @internal
 */
exports.CreateTableNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'CreateTableNode';
    },
    create(table) {
        return (0, object_utils_js_1.freeze)({
            kind: 'CreateTableNode',
            table,
            columns: (0, object_utils_js_1.freeze)([]),
        });
    },
    cloneWithColumn(createTable, column) {
        return (0, object_utils_js_1.freeze)({
            ...createTable,
            columns: (0, object_utils_js_1.freeze)([...createTable.columns, column]),
        });
    },
    cloneWithConstraint(createTable, constraint) {
        return (0, object_utils_js_1.freeze)({
            ...createTable,
            constraints: createTable.constraints
                ? (0, object_utils_js_1.freeze)([...createTable.constraints, constraint])
                : (0, object_utils_js_1.freeze)([constraint]),
        });
    },
    cloneWithFrontModifier(createTable, modifier) {
        return (0, object_utils_js_1.freeze)({
            ...createTable,
            frontModifiers: createTable.frontModifiers
                ? (0, object_utils_js_1.freeze)([...createTable.frontModifiers, modifier])
                : (0, object_utils_js_1.freeze)([modifier]),
        });
    },
    cloneWithEndModifier(createTable, modifier) {
        return (0, object_utils_js_1.freeze)({
            ...createTable,
            endModifiers: createTable.endModifiers
                ? (0, object_utils_js_1.freeze)([...createTable.endModifiers, modifier])
                : (0, object_utils_js_1.freeze)([modifier]),
        });
    },
    cloneWith(createTable, params) {
        return (0, object_utils_js_1.freeze)({
            ...createTable,
            ...params,
        });
    },
});
