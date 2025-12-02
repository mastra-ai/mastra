"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns value estimates at requested quantiles from a t-digest sketch
     * @param parser - The command parser
     * @param key - The name of the t-digest sketch
     * @param quantiles - Array of quantiles (between 0 and 1) to get value estimates for
     */
    parseCommand(parser, key, quantiles) {
        parser.push('TDIGEST.QUANTILE');
        parser.pushKey(key);
        for (const quantile of quantiles) {
            parser.push(quantile.toString());
        }
    },
    transformReply: generic_transformers_1.transformDoubleArrayReply
};
//# sourceMappingURL=QUANTILE.js.map