"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Merges multiple t-digest sketches into one, with optional compression and override settings
     * @param parser - The command parser
     * @param destination - The name of the destination t-digest sketch
     * @param source - One or more source sketch names to merge from
     * @param options - Optional parameters for merge operation
     * @param options.COMPRESSION - New compression value for merged sketch
     * @param options.OVERRIDE - If true, override destination sketch if it exists
     */
    parseCommand(parser, destination, source, options) {
        parser.push('TDIGEST.MERGE');
        parser.pushKey(destination);
        parser.pushKeysLength(source);
        if (options?.COMPRESSION !== undefined) {
            parser.push('COMPRESSION', options.COMPRESSION.toString());
        }
        if (options?.OVERRIDE) {
            parser.push('OVERRIDE');
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=MERGE.js.map