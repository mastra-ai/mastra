"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const LCS_1 = __importDefault(require("./LCS"));
exports.default = {
    IS_READ_ONLY: LCS_1.default.IS_READ_ONLY,
    /**
     * Constructs the LCS command with IDX option
     *
     * @param parser - The command parser
     * @param key1 - First key containing the first string
     * @param key2 - Second key containing the second string
     * @param options - Additional options for the LCS IDX command
     * @see https://redis.io/commands/lcs/
     */
    parseCommand(parser, key1, key2, options) {
        LCS_1.default.parseCommand(parser, key1, key2);
        parser.push('IDX');
        if (options?.MINMATCHLEN) {
            parser.push('MINMATCHLEN', options.MINMATCHLEN.toString());
        }
    },
    transformReply: {
        2: (reply) => ({
            matches: reply[1],
            len: reply[3]
        }),
        3: undefined
    }
};
//# sourceMappingURL=LCS_IDX.js.map