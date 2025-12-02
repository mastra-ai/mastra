"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformRangeArguments = exports.parseRangeArguments = exports.TIME_SERIES_BUCKET_TIMESTAMP = void 0;
const helpers_1 = require("./helpers");
exports.TIME_SERIES_BUCKET_TIMESTAMP = {
    LOW: '-',
    MIDDLE: '~',
    END: '+'
};
function parseRangeArguments(parser, fromTimestamp, toTimestamp, options) {
    parser.push((0, helpers_1.transformTimestampArgument)(fromTimestamp), (0, helpers_1.transformTimestampArgument)(toTimestamp));
    if (options?.LATEST) {
        parser.push('LATEST');
    }
    if (options?.FILTER_BY_TS) {
        parser.push('FILTER_BY_TS');
        for (const timestamp of options.FILTER_BY_TS) {
            parser.push((0, helpers_1.transformTimestampArgument)(timestamp));
        }
    }
    if (options?.FILTER_BY_VALUE) {
        parser.push('FILTER_BY_VALUE', options.FILTER_BY_VALUE.min.toString(), options.FILTER_BY_VALUE.max.toString());
    }
    if (options?.COUNT !== undefined) {
        parser.push('COUNT', options.COUNT.toString());
    }
    if (options?.AGGREGATION) {
        if (options?.ALIGN !== undefined) {
            parser.push('ALIGN', (0, helpers_1.transformTimestampArgument)(options.ALIGN));
        }
        parser.push('AGGREGATION', options.AGGREGATION.type, (0, helpers_1.transformTimestampArgument)(options.AGGREGATION.timeBucket));
        if (options.AGGREGATION.BUCKETTIMESTAMP) {
            parser.push('BUCKETTIMESTAMP', options.AGGREGATION.BUCKETTIMESTAMP);
        }
        if (options.AGGREGATION.EMPTY) {
            parser.push('EMPTY');
        }
    }
}
exports.parseRangeArguments = parseRangeArguments;
function transformRangeArguments(parser, key, fromTimestamp, toTimestamp, options) {
    parser.pushKey(key);
    parseRangeArguments(parser, fromTimestamp, toTimestamp, options);
}
exports.transformRangeArguments = transformRangeArguments;
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Gets samples from a time series within a time range
     * @param args - Arguments passed to the {@link transformRangeArguments} function
     */
    parseCommand(...args) {
        const parser = args[0];
        parser.push('TS.RANGE');
        transformRangeArguments(...args);
    },
    transformReply: {
        2(reply) {
            return helpers_1.transformSamplesReply[2](reply);
        },
        3(reply) {
            return helpers_1.transformSamplesReply[3](reply);
        }
    }
};
//# sourceMappingURL=RANGE.js.map