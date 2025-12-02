"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnakeCaseTransformer = void 0;
const operation_node_transformer_js_1 = require("../../operation-node/operation-node-transformer.js");
class SnakeCaseTransformer extends operation_node_transformer_js_1.OperationNodeTransformer {
    #snakeCase;
    constructor(snakeCase) {
        super();
        this.#snakeCase = snakeCase;
    }
    transformIdentifier(node, queryId) {
        node = super.transformIdentifier(node, queryId);
        return {
            ...node,
            name: this.#snakeCase(node.name),
        };
    }
}
exports.SnakeCaseTransformer = SnakeCaseTransformer;
