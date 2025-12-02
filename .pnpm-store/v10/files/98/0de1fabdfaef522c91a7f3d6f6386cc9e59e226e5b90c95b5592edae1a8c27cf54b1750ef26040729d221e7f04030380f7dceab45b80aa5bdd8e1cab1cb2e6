"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MergeQueryNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const when_node_js_1 = require("./when-node.js");
/**
 * @internal
 */
exports.MergeQueryNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'MergeQueryNode';
    },
    create(into, withNode) {
        return (0, object_utils_js_1.freeze)({
            kind: 'MergeQueryNode',
            into,
            ...(withNode && { with: withNode }),
        });
    },
    cloneWithUsing(mergeNode, using) {
        return (0, object_utils_js_1.freeze)({
            ...mergeNode,
            using,
        });
    },
    cloneWithWhen(mergeNode, when) {
        return (0, object_utils_js_1.freeze)({
            ...mergeNode,
            whens: mergeNode.whens
                ? (0, object_utils_js_1.freeze)([...mergeNode.whens, when])
                : (0, object_utils_js_1.freeze)([when]),
        });
    },
    cloneWithThen(mergeNode, then) {
        return (0, object_utils_js_1.freeze)({
            ...mergeNode,
            whens: mergeNode.whens
                ? (0, object_utils_js_1.freeze)([
                    ...mergeNode.whens.slice(0, -1),
                    when_node_js_1.WhenNode.cloneWithResult(mergeNode.whens[mergeNode.whens.length - 1], then),
                ])
                : undefined,
        });
    },
});
