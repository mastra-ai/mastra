"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the XPENDING command with range parameters to get detailed information about pending messages
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param group - Name of the consumer group
     * @param start - Start of ID range (use '-' for minimum ID)
     * @param end - End of ID range (use '+' for maximum ID)
     * @param count - Maximum number of messages to return
     * @param options - Additional filtering options
     * @returns Array of pending message details
     * @see https://redis.io/commands/xpending/
     */
    parseCommand(parser, key, group, start, end, count, options) {
        parser.push('XPENDING');
        parser.pushKey(key);
        parser.push(group);
        if (options?.IDLE !== undefined) {
            parser.push('IDLE', options.IDLE.toString());
        }
        parser.push(start, end, count.toString());
        if (options?.consumer) {
            parser.push(options.consumer);
        }
    },
    /**
     * Transforms the raw XPENDING RANGE reply into a structured array of message details
     *
     * @param reply - Raw reply from Redis
     * @returns Array of objects containing message ID, consumer, idle time, and delivery count
     */
    transformReply(reply) {
        return reply.map(pending => {
            const unwrapped = pending;
            return {
                id: unwrapped[0],
                consumer: unwrapped[1],
                millisecondsSinceLastDelivery: unwrapped[2],
                deliveriesCounter: unwrapped[3]
            };
        });
    }
};
//# sourceMappingURL=XPENDING_RANGE.js.map