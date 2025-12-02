"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Initialize a Count-Min Sketch using error rate and probability parameters
     * @param parser - The command parser
     * @param key - The name of the sketch
     * @param error - Estimate error, as a decimal between 0 and 1
     * @param probability - The desired probability for inflated count, as a decimal between 0 and 1
     */
    parseCommand(parser, key, error, probability) {
        parser.push('CMS.INITBYPROB');
        parser.pushKey(key);
        parser.push(error.toString(), probability.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=INITBYPROB.js.map