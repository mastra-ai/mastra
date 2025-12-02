"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Acknowledges and deletes one or multiple messages for a stream consumer group
 */
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the XACKDEL command to acknowledge and delete one or multiple messages for a stream consumer group
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param group - The consumer group name
     * @param id - One or more message IDs to acknowledge and delete
     * @param policy - Policy to apply when deleting entries (optional, defaults to KEEPREF)
     * @returns Array of integers: -1 (not found), 1 (acknowledged and deleted), 2 (acknowledged with dangling refs)
     * @see https://redis.io/commands/xackdel/
     */
    parseCommand(parser, key, group, id, policy) {
        parser.push("XACKDEL");
        parser.pushKey(key);
        parser.push(group);
        if (policy) {
            parser.push(policy);
        }
        parser.push("IDS");
        parser.pushVariadicWithLength(id);
    },
    transformReply: undefined,
};
//# sourceMappingURL=XACKDEL.js.map