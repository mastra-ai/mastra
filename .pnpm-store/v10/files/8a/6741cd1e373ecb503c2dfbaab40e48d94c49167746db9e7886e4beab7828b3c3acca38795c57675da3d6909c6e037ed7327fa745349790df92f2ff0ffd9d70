"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FromNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.FromNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'FromNode';
    },
    create(froms) {
        return (0, object_utils_js_1.freeze)({
            kind: 'FromNode',
            froms: (0, object_utils_js_1.freeze)(froms),
        });
    },
    cloneWithFroms(from, froms) {
        return (0, object_utils_js_1.freeze)({
            ...from,
            froms: (0, object_utils_js_1.freeze)([...from.froms, ...froms]),
        });
    },
});
