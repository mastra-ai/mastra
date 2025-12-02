"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransformMRangeSelectedLabelsArguments = void 0;
const helpers_1 = require("./helpers");
const RANGE_1 = require("./RANGE");
const MGET_1 = require("./MGET");
/**
 * Creates a function that parses arguments for multi-range commands with selected labels
 * @param command - The command name to use (TS.MRANGE or TS.MREVRANGE)
 */
function createTransformMRangeSelectedLabelsArguments(command) {
    return (parser, fromTimestamp, toTimestamp, selectedLabels, filter, options) => {
        parser.push(command);
        (0, RANGE_1.parseRangeArguments)(parser, fromTimestamp, toTimestamp, options);
        (0, helpers_1.parseSelectedLabelsArguments)(parser, selectedLabels);
        (0, MGET_1.parseFilterArgument)(parser, filter);
    };
}
exports.createTransformMRangeSelectedLabelsArguments = createTransformMRangeSelectedLabelsArguments;
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Gets samples for time series matching a filter with selected labels
     * @param parser - The command parser
     * @param fromTimestamp - Start timestamp for range
     * @param toTimestamp - End timestamp for range
     * @param selectedLabels - Labels to include in the output
     * @param filter - Filter to match time series keys
     * @param options - Optional parameters for the command
     */
    parseCommand: createTransformMRangeSelectedLabelsArguments('TS.MRANGE'),
    transformReply: {
        2(reply, _, typeMapping) {
            return (0, helpers_1.resp2MapToValue)(reply, ([_key, labels, samples]) => {
                return {
                    labels: (0, helpers_1.transformRESP2Labels)(labels, typeMapping),
                    samples: helpers_1.transformSamplesReply[2](samples)
                };
            }, typeMapping);
        },
        3(reply) {
            return (0, helpers_1.resp3MapToValue)(reply, ([_key, labels, samples]) => {
                return {
                    labels,
                    samples: helpers_1.transformSamplesReply[3](samples)
                };
            });
        }
    },
};
//# sourceMappingURL=MRANGE_SELECTED_LABELS.js.map