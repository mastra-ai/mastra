"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("./helpers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Alters the configuration of an existing time series
     * @param parser - The command parser
     * @param key - The key name for the time series
     * @param options - Configuration parameters to alter
     */
    parseCommand(parser, key, options) {
        parser.push('TS.ALTER');
        parser.pushKey(key);
        (0, helpers_1.parseRetentionArgument)(parser, options?.RETENTION);
        (0, helpers_1.parseChunkSizeArgument)(parser, options?.CHUNK_SIZE);
        (0, helpers_1.parseDuplicatePolicy)(parser, options?.DUPLICATE_POLICY);
        (0, helpers_1.parseLabelsArgument)(parser, options?.LABELS);
        (0, helpers_1.parseIgnoreArgument)(parser, options?.IGNORE);
    },
    transformReply: undefined
};
//# sourceMappingURL=ALTER.js.map