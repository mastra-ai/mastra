"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFilterArgument = exports.parseLatestArgument = void 0;
const helpers_1 = require("./helpers");
/**
 * Adds LATEST argument to command if specified
 * @param parser - The command parser
 * @param latest - Whether to include the LATEST argument
 */
function parseLatestArgument(parser, latest) {
    if (latest) {
        parser.push('LATEST');
    }
}
exports.parseLatestArgument = parseLatestArgument;
/**
 * Adds FILTER argument to command
 * @param parser - The command parser
 * @param filter - Filter to match time series keys
 */
function parseFilterArgument(parser, filter) {
    parser.push('FILTER');
    parser.pushVariadic(filter);
}
exports.parseFilterArgument = parseFilterArgument;
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Gets the last samples matching a specific filter from multiple time series
     * @param parser - The command parser
     * @param filter - Filter to match time series keys
     * @param options - Optional parameters for the command
     */
    parseCommand(parser, filter, options) {
        parser.push('TS.MGET');
        parseLatestArgument(parser, options?.LATEST);
        parseFilterArgument(parser, filter);
    },
    transformReply: {
        2(reply, _, typeMapping) {
            return (0, helpers_1.resp2MapToValue)(reply, ([, , sample]) => {
                return {
                    sample: helpers_1.transformSampleReply[2](sample)
                };
            }, typeMapping);
        },
        3(reply) {
            return (0, helpers_1.resp3MapToValue)(reply, ([, sample]) => {
                return {
                    sample: helpers_1.transformSampleReply[3](sample)
                };
            });
        }
    }
};
//# sourceMappingURL=MGET.js.map