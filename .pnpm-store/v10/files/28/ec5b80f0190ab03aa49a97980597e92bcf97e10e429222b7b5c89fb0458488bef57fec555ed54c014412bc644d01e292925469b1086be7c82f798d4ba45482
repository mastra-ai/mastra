"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutputNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.OutputNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'OutputNode';
    },
    create(selections) {
        return (0, object_utils_js_1.freeze)({
            kind: 'OutputNode',
            selections: (0, object_utils_js_1.freeze)(selections),
        });
    },
    cloneWithSelections(output, selections) {
        return (0, object_utils_js_1.freeze)({
            ...output,
            selections: output.selections
                ? (0, object_utils_js_1.freeze)([...output.selections, ...selections])
                : (0, object_utils_js_1.freeze)(selections),
        });
    },
});
