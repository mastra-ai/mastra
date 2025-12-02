"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReturningNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.ReturningNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'ReturningNode';
    },
    create(selections) {
        return (0, object_utils_js_1.freeze)({
            kind: 'ReturningNode',
            selections: (0, object_utils_js_1.freeze)(selections),
        });
    },
    cloneWithSelections(returning, selections) {
        return (0, object_utils_js_1.freeze)({
            ...returning,
            selections: returning.selections
                ? (0, object_utils_js_1.freeze)([...returning.selections, ...selections])
                : (0, object_utils_js_1.freeze)(selections),
        });
    },
});
