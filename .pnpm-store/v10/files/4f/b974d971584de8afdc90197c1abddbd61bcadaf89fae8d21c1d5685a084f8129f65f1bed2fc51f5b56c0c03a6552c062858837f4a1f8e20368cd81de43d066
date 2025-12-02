"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Command for removing a consumer from a consumer group
 */
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the XGROUP DELCONSUMER command to remove a consumer from a consumer group
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param group - Name of the consumer group
     * @param consumer - Name of the consumer to remove
     * @returns The number of pending messages owned by the deleted consumer
     * @see https://redis.io/commands/xgroup-delconsumer/
     */
    parseCommand(parser, key, group, consumer) {
        parser.push('XGROUP', 'DELCONSUMER');
        parser.pushKey(key);
        parser.push(group, consumer);
    },
    transformReply: undefined
};
//# sourceMappingURL=XGROUP_DELCONSUMER.js.map