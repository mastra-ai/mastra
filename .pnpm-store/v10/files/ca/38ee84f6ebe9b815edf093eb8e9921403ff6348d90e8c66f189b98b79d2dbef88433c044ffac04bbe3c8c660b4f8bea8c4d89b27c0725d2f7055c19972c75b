"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the XINFO GROUPS command to list the consumer groups of a stream
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @returns Array of consumer group information objects
     * @see https://redis.io/commands/xinfo-groups/
     */
    parseCommand(parser, key) {
        parser.push('XINFO', 'GROUPS');
        parser.pushKey(key);
    },
    transformReply: {
        /**
         * Transforms RESP2 reply into a structured consumer group information array
         *
         * @param reply - Raw RESP2 reply from Redis
         * @returns Array of consumer group information objects containing:
         *          name - Name of the consumer group
         *          consumers - Number of consumers in the group
         *          pending - Number of pending messages for the group
         *          last-delivered-id - ID of the last delivered message
         *          entries-read - Number of entries read in the group (Redis 7.0+)
         *          lag - Number of entries not read by the group (Redis 7.0+)
         */
        2: (reply) => {
            return reply.map(group => {
                const unwrapped = group;
                return {
                    name: unwrapped[1],
                    consumers: unwrapped[3],
                    pending: unwrapped[5],
                    'last-delivered-id': unwrapped[7],
                    'entries-read': unwrapped[9],
                    lag: unwrapped[11]
                };
            });
        },
        3: undefined
    }
};
//# sourceMappingURL=XINFO_GROUPS.js.map