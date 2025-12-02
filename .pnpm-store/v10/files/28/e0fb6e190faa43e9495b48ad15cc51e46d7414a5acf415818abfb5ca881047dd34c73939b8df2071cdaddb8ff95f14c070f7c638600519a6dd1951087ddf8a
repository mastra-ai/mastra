"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const XRANGE_1 = __importStar(require("./XRANGE"));
/**
 * Command for reading stream entries in reverse order
 */
exports.default = {
    CACHEABLE: XRANGE_1.default.CACHEABLE,
    IS_READ_ONLY: XRANGE_1.default.IS_READ_ONLY,
    /**
     * Constructs the XREVRANGE command to read stream entries in reverse order
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param args - Arguments tuple containing start ID, end ID, and options
     * @returns Array of messages in the specified range in reverse order
     * @see https://redis.io/commands/xrevrange/
     */
    parseCommand(parser, key, ...args) {
        parser.push('XREVRANGE');
        parser.pushKey(key);
        parser.pushVariadic((0, XRANGE_1.xRangeArguments)(args[0], args[1], args[2]));
    },
    transformReply: XRANGE_1.default.transformReply
};
//# sourceMappingURL=XREVRANGE.js.map