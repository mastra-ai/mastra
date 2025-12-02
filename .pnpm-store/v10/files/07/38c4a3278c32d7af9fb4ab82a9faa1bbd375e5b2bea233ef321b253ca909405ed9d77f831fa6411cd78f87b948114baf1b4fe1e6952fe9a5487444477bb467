"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIncrByArguments = void 0;
const helpers_1 = require("./helpers");
/**
 * Parses arguments for incrementing a time series value
 * @param parser - The command parser
 * @param key - The key name of the time series
 * @param value - The value to increment by
 * @param options - Optional parameters for the command
 */
function parseIncrByArguments(parser, key, value, options) {
    parser.pushKey(key);
    parser.push(value.toString());
    if (options?.TIMESTAMP !== undefined && options?.TIMESTAMP !== null) {
        parser.push('TIMESTAMP', (0, helpers_1.transformTimestampArgument)(options.TIMESTAMP));
    }
    (0, helpers_1.parseRetentionArgument)(parser, options?.RETENTION);
    if (options?.UNCOMPRESSED) {
        parser.push('UNCOMPRESSED');
    }
    (0, helpers_1.parseChunkSizeArgument)(parser, options?.CHUNK_SIZE);
    (0, helpers_1.parseLabelsArgument)(parser, options?.LABELS);
    (0, helpers_1.parseIgnoreArgument)(parser, options?.IGNORE);
}
exports.parseIncrByArguments = parseIncrByArguments;
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Increases the value of a time series by a given amount
     * @param args - Arguments passed to the {@link parseIncrByArguments} function
     */
    parseCommand(...args) {
        const parser = args[0];
        parser.push('TS.INCRBY');
        parseIncrByArguments(...args);
    },
    transformReply: undefined
};
//# sourceMappingURL=INCRBY.js.map