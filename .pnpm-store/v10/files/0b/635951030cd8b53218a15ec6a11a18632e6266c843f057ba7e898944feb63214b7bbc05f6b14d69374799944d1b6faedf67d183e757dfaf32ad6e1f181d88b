"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const XAUTOCLAIM_1 = __importDefault(require("./XAUTOCLAIM"));
exports.default = {
    IS_READ_ONLY: XAUTOCLAIM_1.default.IS_READ_ONLY,
    /**
     * Constructs the XAUTOCLAIM command with JUSTID option to get only message IDs
     *
     * @param args - Same parameters as XAUTOCLAIM command
     * @returns Object containing nextId and arrays of claimed and deleted message IDs
     * @see https://redis.io/commands/xautoclaim/
     */
    parseCommand(...args) {
        const parser = args[0];
        XAUTOCLAIM_1.default.parseCommand(...args);
        parser.push('JUSTID');
    },
    /**
     * Transforms the raw XAUTOCLAIM JUSTID reply into a structured object
     *
     * @param reply - Raw reply from Redis
     * @returns Structured object containing nextId, message IDs, and deleted message IDs
     */
    transformReply(reply) {
        return {
            nextId: reply[0],
            messages: reply[1],
            deletedMessages: reply[2]
        };
    }
};
//# sourceMappingURL=XAUTOCLAIM_JUSTID.js.map