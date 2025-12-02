"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeduplicateJoinsPlugin = void 0;
const deduplicate_joins_transformer_js_1 = require("./deduplicate-joins-transformer.js");
/**
 * Plugin that removes duplicate joins from queries.
 *
 * See [this recipe](https://github.com/kysely-org/kysely/blob/master/site/docs/recipes/0008-deduplicate-joins.md)
 */
class DeduplicateJoinsPlugin {
    #transformer = new deduplicate_joins_transformer_js_1.DeduplicateJoinsTransformer();
    transformQuery(args) {
        return this.#transformer.transformNode(args.node, args.queryId);
    }
    transformResult(args) {
        return Promise.resolve(args.result);
    }
}
exports.DeduplicateJoinsPlugin = DeduplicateJoinsPlugin;
