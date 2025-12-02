"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransformMRangeArguments = void 0;
const helpers_1 = require("./helpers");
const RANGE_1 = require("./RANGE");
const MGET_1 = require("./MGET");
/**
 * Creates a function that parses arguments for multi-range commands
 * @param command - The command name to use (TS.MRANGE or TS.MREVRANGE)
 */
function createTransformMRangeArguments(command) {
    return (parser, fromTimestamp, toTimestamp, filter, options) => {
        parser.push(command);
        (0, RANGE_1.parseRangeArguments)(parser, fromTimestamp, toTimestamp, options);
        (0, MGET_1.parseFilterArgument)(parser, filter);
    };
}
exports.createTransformMRangeArguments = createTransformMRangeArguments;
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Gets samples for time series matching a specific filter within a time range
     * @param parser - The command parser
     * @param fromTimestamp - Start timestamp for range
     * @param toTimestamp - End timestamp for range
     * @param filter - Filter to match time series keys
     * @param options - Optional parameters for the command
     */
    parseCommand: createTransformMRangeArguments('TS.MRANGE'),
    transformReply: {
        2(reply, _, typeMapping) {
            return (0, helpers_1.resp2MapToValue)(reply, ([_key, _labels, samples]) => {
                return helpers_1.transformSamplesReply[2](samples);
            }, typeMapping);
        },
        3(reply) {
            return (0, helpers_1.resp3MapToValue)(reply, ([_labels, _metadata, samples]) => {
                return helpers_1.transformSamplesReply[3](samples);
            });
        }
    },
};
//# sourceMappingURL=MRANGE.js.map