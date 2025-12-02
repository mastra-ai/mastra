/// <reference types="./camel-case-transformer.d.ts" />
import { OperationNodeTransformer } from '../../operation-node/operation-node-transformer.js';
export class SnakeCaseTransformer extends OperationNodeTransformer {
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
