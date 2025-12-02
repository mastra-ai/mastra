"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushXReadStreams = void 0;
const generic_transformers_1 = require("./generic-transformers");
/**
 * Helper function to push stream keys and IDs to the command parser
 *
 * @param parser - The command parser
 * @param streams - Single stream or array of streams to read from
 */
function pushXReadStreams(parser, streams) {
    parser.push('STREAMS');
    if (Array.isArray(streams)) {
        for (let i = 0; i < streams.length; i++) {
            parser.pushKey(streams[i].key);
        }
        for (let i = 0; i < streams.length; i++) {
            parser.push(streams[i].id);
        }
    }
    else {
        parser.pushKey(streams.key);
        parser.push(streams.id);
    }
}
exports.pushXReadStreams = pushXReadStreams;
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the XREAD command to read messages from one or more streams
     *
     * @param parser - The command parser
     * @param streams - Single stream or array of streams to read from
     * @param options - Additional options for reading streams
     * @returns Array of stream entries, each containing the stream name and its messages
     * @see https://redis.io/commands/xread/
     */
    parseCommand(parser, streams, options) {
        parser.push('XREAD');
        if (options?.COUNT) {
            parser.push('COUNT', options.COUNT.toString());
        }
        if (options?.BLOCK !== undefined) {
            parser.push('BLOCK', options.BLOCK.toString());
        }
        pushXReadStreams(parser, streams);
    },
    /**
     * Transform functions for different RESP versions
     */
    transformReply: {
        2: generic_transformers_1.transformStreamsMessagesReplyResp2,
        3: undefined
    },
    unstableResp3: true
};
//# sourceMappingURL=XREAD.js.map