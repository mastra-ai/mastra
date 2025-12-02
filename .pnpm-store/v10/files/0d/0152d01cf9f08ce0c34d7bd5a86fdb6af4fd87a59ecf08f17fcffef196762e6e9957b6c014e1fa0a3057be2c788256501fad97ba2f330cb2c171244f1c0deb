"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONPathNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.JSONPathNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'JSONPathNode';
    },
    create(inOperator) {
        return (0, object_utils_js_1.freeze)({
            kind: 'JSONPathNode',
            inOperator,
            pathLegs: (0, object_utils_js_1.freeze)([]),
        });
    },
    cloneWithLeg(jsonPathNode, pathLeg) {
        return (0, object_utils_js_1.freeze)({
            ...jsonPathNode,
            pathLegs: (0, object_utils_js_1.freeze)([...jsonPathNode.pathLegs, pathLeg]),
        });
    },
});
