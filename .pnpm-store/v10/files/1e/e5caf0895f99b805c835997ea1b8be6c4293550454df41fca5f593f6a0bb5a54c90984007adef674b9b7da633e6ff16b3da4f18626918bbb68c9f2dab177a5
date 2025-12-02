"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const LPOS_1 = __importDefault(require("./LPOS"));
exports.default = {
    CACHEABLE: LPOS_1.default.CACHEABLE,
    IS_READ_ONLY: LPOS_1.default.IS_READ_ONLY,
    /**
     * Constructs the LPOS command with COUNT option
     *
     * @param parser - The command parser
     * @param key - The key of the list
     * @param element - The element to search for
     * @param count - The number of positions to return
     * @param options - Optional parameters for RANK and MAXLEN
     * @see https://redis.io/commands/lpos/
     */
    parseCommand(parser, key, element, count, options) {
        LPOS_1.default.parseCommand(parser, key, element, options);
        parser.push('COUNT', count.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=LPOS_COUNT.js.map