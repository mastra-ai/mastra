"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchedNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.MatchedNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'MatchedNode';
    },
    create(not, bySource = false) {
        return (0, object_utils_js_1.freeze)({
            kind: 'MatchedNode',
            not,
            bySource,
        });
    },
});
