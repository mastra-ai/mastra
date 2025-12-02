"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsingNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.UsingNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'UsingNode';
    },
    create(tables) {
        return (0, object_utils_js_1.freeze)({
            kind: 'UsingNode',
            tables: (0, object_utils_js_1.freeze)(tables),
        });
    },
    cloneWithTables(using, tables) {
        return (0, object_utils_js_1.freeze)({
            ...using,
            tables: (0, object_utils_js_1.freeze)([...using.tables, ...tables]),
        });
    },
});
