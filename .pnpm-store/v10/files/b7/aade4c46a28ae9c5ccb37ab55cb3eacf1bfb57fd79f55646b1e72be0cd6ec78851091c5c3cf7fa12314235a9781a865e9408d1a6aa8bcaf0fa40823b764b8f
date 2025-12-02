/// <reference types="./immediate-value-plugin.d.ts" />
import { ImmediateValueTransformer } from './immediate-value-transformer.js';
/**
 * Transforms all ValueNodes to immediate.
 *
 * WARNING! This should never be part of the public API. Users should never use this.
 * This is an internal helper.
 *
 * @internal
 */
export class ImmediateValuePlugin {
    #transformer = new ImmediateValueTransformer();
    transformQuery(args) {
        return this.#transformer.transformNode(args.node, args.queryId);
    }
    transformResult(args) {
        return Promise.resolve(args.result);
    }
}
