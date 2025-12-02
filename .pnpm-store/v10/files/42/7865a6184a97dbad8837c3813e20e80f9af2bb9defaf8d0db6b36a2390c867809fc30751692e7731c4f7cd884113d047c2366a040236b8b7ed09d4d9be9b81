"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchNode = void 0;
const value_node_js_1 = require("./value-node.js");
/**
 * @internal
 */
exports.FetchNode = {
    is(node) {
        return node.kind === 'FetchNode';
    },
    create(rowCount, modifier) {
        return {
            kind: 'FetchNode',
            rowCount: value_node_js_1.ValueNode.create(rowCount),
            modifier,
        };
    },
};
