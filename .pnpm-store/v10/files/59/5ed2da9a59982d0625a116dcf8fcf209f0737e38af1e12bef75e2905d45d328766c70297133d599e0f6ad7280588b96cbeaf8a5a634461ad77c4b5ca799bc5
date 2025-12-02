"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Command for trimming a stream to a specified length or minimum ID
 */
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the XTRIM command to trim a stream by length or minimum ID
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param strategy - Trim by maximum length (MAXLEN) or minimum ID (MINID)
     * @param threshold - Maximum length or minimum ID threshold
     * @param options - Additional options for trimming
     * @returns Number of entries removed from the stream
     * @see https://redis.io/commands/xtrim/
     */
    parseCommand(parser, key, strategy, threshold, options) {
        parser.push('XTRIM');
        parser.pushKey(key);
        parser.push(strategy);
        if (options?.strategyModifier) {
            parser.push(options.strategyModifier);
        }
        parser.push(threshold.toString());
        if (options?.LIMIT) {
            parser.push('LIMIT', options.LIMIT.toString());
        }
        if (options?.policy) {
            parser.push(options.policy);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=XTRIM.js.map