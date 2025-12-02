"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Constructs the SADD command
     *
     * @param parser - The command parser
     * @param key - The set key to add members to
     * @param members - One or more members to add to the set
     * @see https://redis.io/commands/sadd/
     */
    parseCommand(parser, key, members) {
        parser.push('SADD');
        parser.pushKey(key);
        parser.pushVariadic(members);
    },
    transformReply: undefined
};
//# sourceMappingURL=SADD.js.map