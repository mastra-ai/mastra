"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AGGREGATE_WITHCURSOR_1 = __importDefault(require("./AGGREGATE_WITHCURSOR"));
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Reads from an existing cursor to get more results from an index.
     * @param parser - The command parser
     * @param index - The index name that contains the cursor
     * @param cursor - The cursor ID to read from
     * @param options - Optional parameters:
     *   - COUNT: Maximum number of results to return
     */
    parseCommand(parser, index, cursor, options) {
        parser.push('FT.CURSOR', 'READ', index, cursor.toString());
        if (options?.COUNT !== undefined) {
            parser.push('COUNT', options.COUNT.toString());
        }
    },
    transformReply: AGGREGATE_WITHCURSOR_1.default.transformReply,
    unstableResp3: true
};
//# sourceMappingURL=CURSOR_READ.js.map