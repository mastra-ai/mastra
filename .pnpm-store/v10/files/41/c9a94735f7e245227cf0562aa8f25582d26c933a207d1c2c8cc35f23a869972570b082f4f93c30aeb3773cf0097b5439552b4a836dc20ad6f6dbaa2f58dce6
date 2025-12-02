"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("./helpers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Creates or appends a sample to a time series
     * @param parser - The command parser
     * @param key - The key name for the time series
     * @param timestamp - The timestamp of the sample
     * @param value - The value of the sample
     * @param options - Optional configuration parameters
     */
    parseCommand(parser, key, timestamp, value, options) {
        parser.push('TS.ADD');
        parser.pushKey(key);
        parser.push((0, helpers_1.transformTimestampArgument)(timestamp), value.toString());
        (0, helpers_1.parseRetentionArgument)(parser, options?.RETENTION);
        (0, helpers_1.parseEncodingArgument)(parser, options?.ENCODING);
        (0, helpers_1.parseChunkSizeArgument)(parser, options?.CHUNK_SIZE);
        if (options?.ON_DUPLICATE) {
            parser.push('ON_DUPLICATE', options.ON_DUPLICATE);
        }
        (0, helpers_1.parseLabelsArgument)(parser, options?.LABELS);
        (0, helpers_1.parseIgnoreArgument)(parser, options?.IGNORE);
    },
    transformReply: undefined
};
//# sourceMappingURL=ADD.js.map