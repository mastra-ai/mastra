"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the PUBSUB NUMSUB command
     *
     * @param parser - The command parser
     * @param channels - Optional channel names to get subscription count for
     * @see https://redis.io/commands/pubsub-numsub/
     */
    parseCommand(parser, channels) {
        parser.push('PUBSUB', 'NUMSUB');
        if (channels) {
            parser.pushVariadic(channels);
        }
    },
    /**
     * Transforms the PUBSUB NUMSUB reply into a record of channel name to subscriber count
     *
     * @param rawReply - The raw reply from Redis
     * @returns Record mapping channel names to their subscriber counts
     */
    transformReply(rawReply) {
        const reply = Object.create(null);
        let i = 0;
        while (i < rawReply.length) {
            reply[rawReply[i++].toString()] = rawReply[i++].toString();
        }
        return reply;
    }
};
//# sourceMappingURL=PUBSUB_NUMSUB.js.map