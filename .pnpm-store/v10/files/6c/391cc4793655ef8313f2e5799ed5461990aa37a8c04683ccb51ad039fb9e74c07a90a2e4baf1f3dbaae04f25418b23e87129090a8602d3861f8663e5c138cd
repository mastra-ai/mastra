"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMRangeWithLabelsGroupByTransformArguments = void 0;
const helpers_1 = require("./helpers");
const RANGE_1 = require("./RANGE");
const MRANGE_GROUPBY_1 = require("./MRANGE_GROUPBY");
const MGET_1 = require("./MGET");
function createMRangeWithLabelsGroupByTransformArguments(command) {
    return (parser, fromTimestamp, toTimestamp, filter, groupBy, options) => {
        parser.push(command);
        (0, RANGE_1.parseRangeArguments)(parser, fromTimestamp, toTimestamp, options);
        parser.push('WITHLABELS');
        (0, MGET_1.parseFilterArgument)(parser, filter);
        (0, MRANGE_GROUPBY_1.parseGroupByArguments)(parser, groupBy);
    };
}
exports.createMRangeWithLabelsGroupByTransformArguments = createMRangeWithLabelsGroupByTransformArguments;
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Gets samples for time series matching a filter with labels and grouping
     * @param parser - The command parser
     * @param fromTimestamp - Start timestamp for range
     * @param toTimestamp - End timestamp for range
     * @param filter - Filter to match time series keys
     * @param groupBy - Group by parameters
     * @param options - Optional parameters for the command
     */
    parseCommand: createMRangeWithLabelsGroupByTransformArguments('TS.MRANGE'),
    transformReply: {
        2(reply, _, typeMapping) {
            return (0, helpers_1.resp2MapToValue)(reply, ([_key, labels, samples]) => {
                const transformed = (0, helpers_1.transformRESP2LabelsWithSources)(labels);
                return {
                    labels: transformed.labels,
                    sources: transformed.sources,
                    samples: helpers_1.transformSamplesReply[2](samples)
                };
            }, typeMapping);
        },
        3(reply) {
            return (0, helpers_1.resp3MapToValue)(reply, ([labels, _metadata, metadata2, samples]) => {
                return {
                    labels,
                    sources: (0, MRANGE_GROUPBY_1.extractResp3MRangeSources)(metadata2),
                    samples: helpers_1.transformSamplesReply[3](samples)
                };
            });
        }
    },
};
//# sourceMappingURL=MRANGE_WITHLABELS_GROUPBY.js.map