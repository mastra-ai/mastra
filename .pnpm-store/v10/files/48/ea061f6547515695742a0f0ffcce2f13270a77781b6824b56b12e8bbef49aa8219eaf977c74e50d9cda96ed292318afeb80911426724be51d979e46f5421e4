"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const XREAD_1 = require("./XREAD");
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the XREADGROUP command to read messages from streams as a consumer group member
     *
     * @param parser - The command parser
     * @param group - Name of the consumer group
     * @param consumer - Name of the consumer in the group
     * @param streams - Single stream or array of streams to read from
     * @param options - Additional options for reading streams
     * @returns Array of stream entries, each containing the stream name and its messages
     * @see https://redis.io/commands/xreadgroup/
     */
    parseCommand(parser, group, consumer, streams, options) {
        parser.push('XREADGROUP', 'GROUP', group, consumer);
        if (options?.COUNT !== undefined) {
            parser.push('COUNT', options.COUNT.toString());
        }
        if (options?.BLOCK !== undefined) {
            parser.push('BLOCK', options.BLOCK.toString());
        }
        if (options?.NOACK) {
            parser.push('NOACK');
        }
        (0, XREAD_1.pushXReadStreams)(parser, streams);
    },
    /**
     * Transform functions for different RESP versions
     */
    transformReply: {
        2: generic_transformers_1.transformStreamsMessagesReplyResp2,
        3: undefined
    },
    unstableResp3: true,
};
//# sourceMappingURL=XREADGROUP.js.map