"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImmediateValuePlugin = void 0;
const immediate_value_transformer_js_1 = require("./immediate-value-transformer.js");
/**
 * Transforms all ValueNodes to immediate.
 *
 * WARNING! This should never be part of the public API. Users should never use this.
 * This is an internal helper.
 *
 * @internal
 */
class ImmediateValuePlugin {
    #transformer = new immediate_value_transformer_js_1.ImmediateValueTransformer();
    transformQuery(args) {
        return this.#transformer.transformNode(args.node, args.queryId);
    }
    transformResult(args) {
        return Promise.resolve(args.result);
    }
}
exports.ImmediateValuePlugin = ImmediateValuePlugin;
