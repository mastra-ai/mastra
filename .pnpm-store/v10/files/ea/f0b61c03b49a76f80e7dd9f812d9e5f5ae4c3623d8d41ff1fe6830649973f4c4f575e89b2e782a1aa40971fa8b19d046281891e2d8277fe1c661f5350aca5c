"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns the mean value from a t-digest sketch after trimming values at specified percentiles
     * @param parser - The command parser
     * @param key - The name of the t-digest sketch
     * @param lowCutPercentile - Lower percentile cutoff (between 0 and 100)
     * @param highCutPercentile - Higher percentile cutoff (between 0 and 100)
     */
    parseCommand(parser, key, lowCutPercentile, highCutPercentile) {
        parser.push('TDIGEST.TRIMMED_MEAN');
        parser.pushKey(key);
        parser.push(lowCutPercentile.toString(), highCutPercentile.toString());
    },
    transformReply: generic_transformers_1.transformDoubleReply
};
//# sourceMappingURL=TRIMMED_MEAN.js.map