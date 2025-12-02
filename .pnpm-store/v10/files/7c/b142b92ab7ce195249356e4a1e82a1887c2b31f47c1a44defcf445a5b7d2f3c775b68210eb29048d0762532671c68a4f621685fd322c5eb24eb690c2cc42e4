"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RawNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.RawNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'RawNode';
    },
    create(sqlFragments, parameters) {
        return (0, object_utils_js_1.freeze)({
            kind: 'RawNode',
            sqlFragments: (0, object_utils_js_1.freeze)(sqlFragments),
            parameters: (0, object_utils_js_1.freeze)(parameters),
        });
    },
    createWithSql(sql) {
        return exports.RawNode.create([sql], []);
    },
    createWithChild(child) {
        return exports.RawNode.create(['', ''], [child]);
    },
    createWithChildren(children) {
        return exports.RawNode.create(new Array(children.length + 1).fill(''), children);
    },
});
