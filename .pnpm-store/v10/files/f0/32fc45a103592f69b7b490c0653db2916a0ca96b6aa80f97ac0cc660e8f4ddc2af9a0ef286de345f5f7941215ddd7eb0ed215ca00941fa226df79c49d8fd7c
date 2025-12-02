"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Command for creating a new consumer in a consumer group
 */
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the XGROUP CREATECONSUMER command to create a new consumer in a consumer group
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param group - Name of the consumer group
     * @param consumer - Name of the consumer to create
     * @returns 1 if the consumer was created, 0 if it already existed
     * @see https://redis.io/commands/xgroup-createconsumer/
     */
    parseCommand(parser, key, group, consumer) {
        parser.push('XGROUP', 'CREATECONSUMER');
        parser.pushKey(key);
        parser.push(group, consumer);
    },
    transformReply: undefined
};
//# sourceMappingURL=XGROUP_CREATECONSUMER.js.map