"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMRangeSelectedLabelsGroupByTransformArguments = void 0;
const helpers_1 = require("./helpers");
const RANGE_1 = require("./RANGE");
const MRANGE_GROUPBY_1 = require("./MRANGE_GROUPBY");
const MGET_1 = require("./MGET");
const MRANGE_SELECTED_LABELS_1 = __importDefault(require("./MRANGE_SELECTED_LABELS"));
/**
 * Creates a function that parses arguments for multi-range commands with selected labels and grouping
 * @param command - The command name to use (TS.MRANGE or TS.MREVRANGE)
 */
function createMRangeSelectedLabelsGroupByTransformArguments(command) {
    return (parser, fromTimestamp, toTimestamp, selectedLabels, filter, groupBy, options) => {
        parser.push(command);
        (0, RANGE_1.parseRangeArguments)(parser, fromTimestamp, toTimestamp, options);
        (0, helpers_1.parseSelectedLabelsArguments)(parser, selectedLabels);
        (0, MGET_1.parseFilterArgument)(parser, filter);
        (0, MRANGE_GROUPBY_1.parseGroupByArguments)(parser, groupBy);
    };
}
exports.createMRangeSelectedLabelsGroupByTransformArguments = createMRangeSelectedLabelsGroupByTransformArguments;
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Gets samples for time series matching a filter with selected labels and grouping
     * @param parser - The command parser
     * @param fromTimestamp - Start timestamp for range
     * @param toTimestamp - End timestamp for range
     * @param selectedLabels - Labels to include in the output
     * @param filter - Filter to match time series keys
     * @param groupBy - Group by parameters
     * @param options - Optional parameters for the command
     */
    parseCommand: createMRangeSelectedLabelsGroupByTransformArguments('TS.MRANGE'),
    transformReply: {
        2: MRANGE_SELECTED_LABELS_1.default.transformReply[2],
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
//# sourceMappingURL=MRANGE_SELECTED_LABELS_GROUPBY.js.map