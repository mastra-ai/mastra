"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the XINFO CONSUMERS command to list the consumers in a consumer group
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param group - Name of the consumer group
     * @returns Array of consumer information objects
     * @see https://redis.io/commands/xinfo-consumers/
     */
    parseCommand(parser, key, group) {
        parser.push('XINFO', 'CONSUMERS');
        parser.pushKey(key);
        parser.push(group);
    },
    transformReply: {
        /**
         * Transforms RESP2 reply into a structured consumer information array
         *
         * @param reply - Raw RESP2 reply from Redis
         * @returns Array of consumer information objects
         */
        2: (reply) => {
            return reply.map(consumer => {
                const unwrapped = consumer;
                return {
                    name: unwrapped[1],
                    pending: unwrapped[3],
                    idle: unwrapped[5],
                    inactive: unwrapped[7]
                };
            });
        },
        3: undefined
    }
};
//# sourceMappingURL=XINFO_CONSUMERS.js.map