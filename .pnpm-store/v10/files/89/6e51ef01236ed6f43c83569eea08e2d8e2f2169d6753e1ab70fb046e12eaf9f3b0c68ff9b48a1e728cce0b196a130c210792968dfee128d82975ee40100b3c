"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransformMRangeWithLabelsArguments = void 0;
const helpers_1 = require("./helpers");
const RANGE_1 = require("./RANGE");
const MGET_1 = require("./MGET");
/**
 * Creates a function that parses arguments for multi-range commands with labels
 * @param command - The command name to use (TS.MRANGE or TS.MREVRANGE)
 */
function createTransformMRangeWithLabelsArguments(command) {
    return (parser, fromTimestamp, toTimestamp, filter, options) => {
        parser.push(command);
        (0, RANGE_1.parseRangeArguments)(parser, fromTimestamp, toTimestamp, options);
        parser.push('WITHLABELS');
        (0, MGET_1.parseFilterArgument)(parser, filter);
    };
}
exports.createTransformMRangeWithLabelsArguments = createTransformMRangeWithLabelsArguments;
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Gets samples for time series matching a filter with labels
     * @param parser - The command parser
     * @param fromTimestamp - Start timestamp for range
     * @param toTimestamp - End timestamp for range
     * @param filter - Filter to match time series keys
     * @param options - Optional parameters for the command
     */
    parseCommand: createTransformMRangeWithLabelsArguments('TS.MRANGE'),
    transformReply: {
        2(reply, _, typeMapping) {
            return (0, helpers_1.resp2MapToValue)(reply, ([_key, labels, samples]) => {
                const unwrappedLabels = labels;
                // TODO: use Map type mapping for labels
                const labelsObject = Object.create(null);
                for (const tuple of unwrappedLabels) {
                    const [key, value] = tuple;
                    const unwrappedKey = key;
                    labelsObject[unwrappedKey.toString()] = value;
                }
                return {
                    labels: labelsObject,
                    samples: helpers_1.transformSamplesReply[2](samples)
                };
            }, typeMapping);
        },
        3(reply) {
            return (0, helpers_1.resp3MapToValue)(reply, ([labels, _metadata, samples]) => {
                return {
                    labels,
                    samples: helpers_1.transformSamplesReply[3](samples)
                };
            });
        }
    },
};
//# sourceMappingURL=MRANGE_WITHLABELS.js.map