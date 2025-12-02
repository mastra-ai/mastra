"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const when_node_js_1 = require("./when-node.js");
/**
 * @internal
 */
exports.CaseNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'CaseNode';
    },
    create(value) {
        return (0, object_utils_js_1.freeze)({
            kind: 'CaseNode',
            value,
        });
    },
    cloneWithWhen(caseNode, when) {
        return (0, object_utils_js_1.freeze)({
            ...caseNode,
            when: (0, object_utils_js_1.freeze)(caseNode.when ? [...caseNode.when, when] : [when]),
        });
    },
    cloneWithThen(caseNode, then) {
        return (0, object_utils_js_1.freeze)({
            ...caseNode,
            when: caseNode.when
                ? (0, object_utils_js_1.freeze)([
                    ...caseNode.when.slice(0, -1),
                    when_node_js_1.WhenNode.cloneWithResult(caseNode.when[caseNode.when.length - 1], then),
                ])
                : undefined,
        });
    },
    cloneWith(caseNode, props) {
        return (0, object_utils_js_1.freeze)({
            ...caseNode,
            ...props,
        });
    },
});
