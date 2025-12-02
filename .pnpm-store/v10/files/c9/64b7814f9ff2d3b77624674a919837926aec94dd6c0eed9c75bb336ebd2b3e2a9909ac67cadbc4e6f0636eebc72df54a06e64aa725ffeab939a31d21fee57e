"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithSchemaPlugin = void 0;
const with_schema_transformer_js_1 = require("./with-schema-transformer.js");
class WithSchemaPlugin {
    #transformer;
    constructor(schema) {
        this.#transformer = new with_schema_transformer_js_1.WithSchemaTransformer(schema);
    }
    transformQuery(args) {
        return this.#transformer.transformNode(args.node, args.queryId);
    }
    async transformResult(args) {
        return args.result;
    }
}
exports.WithSchemaPlugin = WithSchemaPlugin;
