"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the PUBSUB SHARDNUMSUB command
     *
     * @param parser - The command parser
     * @param channels - Optional shard channel names to get subscription count for
     * @see https://redis.io/commands/pubsub-shardnumsub/
     */
    parseCommand(parser, channels) {
        parser.push('PUBSUB', 'SHARDNUMSUB');
        if (channels) {
            parser.pushVariadic(channels);
        }
    },
    /**
     * Transforms the PUBSUB SHARDNUMSUB reply into a record of shard channel name to subscriber count
     *
     * @param reply - The raw reply from Redis
     * @returns Record mapping shard channel names to their subscriber counts
     */
    transformReply(reply) {
        const transformedReply = Object.create(null);
        for (let i = 0; i < reply.length; i += 2) {
            transformedReply[reply[i].toString()] = reply[i + 1];
        }
        return transformedReply;
    }
};
//# sourceMappingURL=PUBSUB_SHARDNUMSUB.js.map