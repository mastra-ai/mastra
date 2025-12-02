"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Estimates the cumulative distribution function for values in a t-digest sketch
     * @param parser - The command parser
     * @param key - The name of the t-digest sketch
     * @param values - Array of values to get CDF estimates for
     */
    parseCommand(parser, key, values) {
        parser.push('TDIGEST.CDF');
        parser.pushKey(key);
        for (const item of values) {
            parser.push(item.toString());
        }
    },
    transformReply: generic_transformers_1.transformDoubleArrayReply
};
//# sourceMappingURL=CDF.js.map