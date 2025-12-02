"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const LPOP_1 = __importDefault(require("./LPOP"));
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the LPOP command with count parameter
     *
     * @param parser - The command parser
     * @param key - The key of the list to pop from
     * @param count - The number of elements to pop
     * @see https://redis.io/commands/lpop/
     */
    parseCommand(parser, key, count) {
        LPOP_1.default.parseCommand(parser, key);
        parser.push(count.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=LPOP_COUNT.js.map