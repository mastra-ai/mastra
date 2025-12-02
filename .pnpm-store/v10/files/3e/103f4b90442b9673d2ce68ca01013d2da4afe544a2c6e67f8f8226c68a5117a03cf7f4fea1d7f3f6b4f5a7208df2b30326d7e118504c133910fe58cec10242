"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const XCLAIM_1 = __importDefault(require("./XCLAIM"));
/**
 * Command variant for XCLAIM that returns only message IDs
 */
exports.default = {
    IS_READ_ONLY: XCLAIM_1.default.IS_READ_ONLY,
    /**
     * Constructs the XCLAIM command with JUSTID option to get only message IDs
     *
     * @param args - Same parameters as XCLAIM command
     * @returns Array of successfully claimed message IDs
     * @see https://redis.io/commands/xclaim/
     */
    parseCommand(...args) {
        const parser = args[0];
        XCLAIM_1.default.parseCommand(...args);
        parser.push('JUSTID');
    },
    /**
     * Transforms the XCLAIM JUSTID reply into an array of message IDs
     *
     * @returns Array of claimed message IDs
     */
    transformReply: undefined
};
//# sourceMappingURL=XCLAIM_JUSTID.js.map