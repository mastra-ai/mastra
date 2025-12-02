"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AGGREGATE_1 = __importDefault(require("./AGGREGATE"));
exports.default = {
    IS_READ_ONLY: AGGREGATE_1.default.IS_READ_ONLY,
    /**
     * Performs an aggregation with a cursor for retrieving large result sets.
     * @param parser - The command parser
     * @param index - Name of the index to query
     * @param query - The aggregation query
     * @param options - Optional parameters:
     *   - All options supported by FT.AGGREGATE
     *   - COUNT: Number of results to return per cursor fetch
     *   - MAXIDLE: Maximum idle time for cursor in milliseconds
     */
    parseCommand(parser, index, query, options) {
        AGGREGATE_1.default.parseCommand(parser, index, query, options);
        parser.push('WITHCURSOR');
        if (options?.COUNT !== undefined) {
            parser.push('COUNT', options.COUNT.toString());
        }
        if (options?.MAXIDLE !== undefined) {
            parser.push('MAXIDLE', options.MAXIDLE.toString());
        }
    },
    transformReply: {
        2: (reply) => {
            return {
                ...AGGREGATE_1.default.transformReply[2](reply[0]),
                cursor: reply[1]
            };
        },
        3: undefined
    },
    unstableResp3: true
};
//# sourceMappingURL=AGGREGATE_WITHCURSOR.js.map