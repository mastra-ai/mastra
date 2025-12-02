"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractResp3MRangeSources = exports.createTransformMRangeGroupByArguments = exports.parseGroupByArguments = exports.TIME_SERIES_REDUCERS = void 0;
const helpers_1 = require("./helpers");
const RANGE_1 = require("./RANGE");
const MGET_1 = require("./MGET");
exports.TIME_SERIES_REDUCERS = {
    AVG: 'AVG',
    SUM: 'SUM',
    MIN: 'MIN',
    MAX: 'MAX',
    RANGE: 'RANGE',
    COUNT: 'COUNT',
    STD_P: 'STD.P',
    STD_S: 'STD.S',
    VAR_P: 'VAR.P',
    VAR_S: 'VAR.S'
};
/**
 * Adds GROUPBY arguments to command
 * @param parser - The command parser
 * @param groupBy - Group by parameters
 */
function parseGroupByArguments(parser, groupBy) {
    parser.push('GROUPBY', groupBy.label, 'REDUCE', groupBy.REDUCE);
}
exports.parseGroupByArguments = parseGroupByArguments;
/**
 * Creates a function that parses arguments for multi-range commands with grouping
 * @param command - The command name to use (TS.MRANGE or TS.MREVRANGE)
 */
function createTransformMRangeGroupByArguments(command) {
    return (parser, fromTimestamp, toTimestamp, filter, groupBy, options) => {
        parser.push(command);
        (0, RANGE_1.parseRangeArguments)(parser, fromTimestamp, toTimestamp, options);
        (0, MGET_1.parseFilterArgument)(parser, filter);
        parseGroupByArguments(parser, groupBy);
    };
}
exports.createTransformMRangeGroupByArguments = createTransformMRangeGroupByArguments;
/**
 * Extracts source keys from RESP3 metadata reply
 * @param raw - Raw metadata from RESP3 reply
 */
function extractResp3MRangeSources(raw) {
    const unwrappedMetadata2 = raw;
    if (unwrappedMetadata2 instanceof Map) {
        return unwrappedMetadata2.get('sources');
    }
    else if (unwrappedMetadata2 instanceof Array) {
        return unwrappedMetadata2[1];
    }
    else {
        return unwrappedMetadata2.sources;
    }
}
exports.extractResp3MRangeSources = extractResp3MRangeSources;
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Gets samples for time series matching a filter within a time range with grouping
     * @param parser - The command parser
     * @param fromTimestamp - Start timestamp for range
     * @param toTimestamp - End timestamp for range
     * @param filter - Filter to match time series keys
     * @param groupBy - Group by parameters
     * @param options - Optional parameters for the command
     */
    parseCommand: createTransformMRangeGroupByArguments('TS.MRANGE'),
    transformReply: {
        2(reply, _, typeMapping) {
            return (0, helpers_1.resp2MapToValue)(reply, ([_key, _labels, samples]) => {
                return {
                    samples: helpers_1.transformSamplesReply[2](samples)
                };
            }, typeMapping);
        },
        3(reply) {
            return (0, helpers_1.resp3MapToValue)(reply, ([_labels, _metadata1, metadata2, samples]) => {
                return {
                    sources: extractResp3MRangeSources(metadata2),
                    samples: helpers_1.transformSamplesReply[3](samples)
                };
            });
        }
    },
};
//# sourceMappingURL=MRANGE_GROUPBY.js.map