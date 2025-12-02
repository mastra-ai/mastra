"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the XAUTOCLAIM command to automatically claim pending messages in a consumer group
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param group - The consumer group name
     * @param consumer - The consumer name that will claim the messages
     * @param minIdleTime - Minimum idle time in milliseconds for a message to be claimed
     * @param start - Message ID to start scanning from
     * @param options - Additional options for the claim operation
     * @returns Object containing nextId, claimed messages, and list of deleted message IDs
     * @see https://redis.io/commands/xautoclaim/
     */
    parseCommand(parser, key, group, consumer, minIdleTime, start, options) {
        parser.push('XAUTOCLAIM');
        parser.pushKey(key);
        parser.push(group, consumer, minIdleTime.toString(), start);
        if (options?.COUNT) {
            parser.push('COUNT', options.COUNT.toString());
        }
    },
    /**
     * Transforms the raw XAUTOCLAIM reply into a structured object
     *
     * @param reply - Raw reply from Redis
     * @param preserve - Preserve options (unused)
     * @param typeMapping - Type mapping for message fields
     * @returns Structured object containing nextId, messages, and deletedMessages
     */
    transformReply(reply, preserve, typeMapping) {
        return {
            nextId: reply[0],
            messages: reply[1].map(generic_transformers_1.transformStreamMessageNullReply.bind(undefined, typeMapping)),
            deletedMessages: reply[2]
        };
    }
};
//# sourceMappingURL=XAUTOCLAIM.js.map