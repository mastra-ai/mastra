/// <reference types="./with-schema-plugin.d.ts" />
import { WithSchemaTransformer } from './with-schema-transformer.js';
export class WithSchemaPlugin {
    #transformer;
    constructor(schema) {
        this.#transformer = new WithSchemaTransformer(schema);
    }
    transformQuery(args) {
        return this.#transformer.transformNode(args.node, args.queryId);
    }
    async transformResult(args) {
        return args.result;
    }
}
