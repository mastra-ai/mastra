"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Creates a new t-digest sketch for storing distributions
     * @param parser - The command parser
     * @param key - The name of the t-digest sketch
     * @param options - Optional parameters for sketch creation
     * @param options.COMPRESSION - Compression parameter that affects performance and accuracy
     */
    parseCommand(parser, key, options) {
        parser.push('TDIGEST.CREATE');
        parser.pushKey(key);
        if (options?.COMPRESSION !== undefined) {
            parser.push('COMPRESSION', options.COMPRESSION.toString());
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=CREATE.js.map