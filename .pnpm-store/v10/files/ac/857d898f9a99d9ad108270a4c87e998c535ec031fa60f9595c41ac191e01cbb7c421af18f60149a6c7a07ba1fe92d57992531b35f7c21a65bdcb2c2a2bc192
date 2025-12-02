"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the MEMORY USAGE command
     *
     * @param parser - The command parser
     * @param key - The key to get memory usage for
     * @param options - Optional parameters including SAMPLES
     * @see https://redis.io/commands/memory-usage/
     */
    parseCommand(parser, key, options) {
        parser.push('MEMORY', 'USAGE');
        parser.pushKey(key);
        if (options?.SAMPLES) {
            parser.push('SAMPLES', options.SAMPLES.toString());
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=MEMORY_USAGE.js.map