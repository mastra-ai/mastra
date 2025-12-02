"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const LCS_1 = __importDefault(require("./LCS"));
exports.default = {
    IS_READ_ONLY: LCS_1.default.IS_READ_ONLY,
    /**
     * Constructs the LCS command with LEN option
     *
     * @param args - The same parameters as LCS command
     * @see https://redis.io/commands/lcs/
     */
    parseCommand(...args) {
        const parser = args[0];
        LCS_1.default.parseCommand(...args);
        parser.push('LEN');
    },
    transformReply: undefined
};
//# sourceMappingURL=LCS_LEN.js.map