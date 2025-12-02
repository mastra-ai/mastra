"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const LCS_IDX_1 = __importDefault(require("./LCS_IDX"));
exports.default = {
    IS_READ_ONLY: LCS_IDX_1.default.IS_READ_ONLY,
    /**
     * Constructs the LCS command with IDX and WITHMATCHLEN options
     *
     * @param args - The same parameters as LCS_IDX command
     * @see https://redis.io/commands/lcs/
     */
    parseCommand(...args) {
        const parser = args[0];
        LCS_IDX_1.default.parseCommand(...args);
        parser.push('WITHMATCHLEN');
    },
    transformReply: {
        2: (reply) => ({
            matches: reply[1],
            len: reply[3]
        }),
        3: undefined
    }
};
//# sourceMappingURL=LCS_IDX_WITHMATCHLEN.js.map