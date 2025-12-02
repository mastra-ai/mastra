"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the XPENDING command to inspect pending messages of a consumer group
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param group - Name of the consumer group
     * @returns Summary of pending messages including total count, ID range, and per-consumer stats
     * @see https://redis.io/commands/xpending/
     */
    parseCommand(parser, key, group) {
        parser.push('XPENDING');
        parser.pushKey(key);
        parser.push(group);
    },
    /**
     * Transforms the raw XPENDING reply into a structured object
     *
     * @param reply - Raw reply from Redis
     * @returns Object containing pending count, ID range, and consumer statistics
     */
    transformReply(reply) {
        const consumers = reply[3];
        return {
            pending: reply[0],
            firstId: reply[1],
            lastId: reply[2],
            consumers: consumers === null ? null : consumers.map(consumer => {
                const [name, deliveriesCounter] = consumer;
                return {
                    name,
                    deliveriesCounter: Number(deliveriesCounter)
                };
            })
        };
    }
};
//# sourceMappingURL=XPENDING.js.map