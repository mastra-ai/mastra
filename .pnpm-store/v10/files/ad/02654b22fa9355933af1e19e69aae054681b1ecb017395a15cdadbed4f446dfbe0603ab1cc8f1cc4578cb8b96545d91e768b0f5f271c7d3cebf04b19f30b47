"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ZADD_1 = require("./ZADD");
const generic_transformers_1 = require("./generic-transformers");
/**
 * Command for incrementing the score of a member in a sorted set
 */
exports.default = {
    /**
     * Constructs the ZADD command with INCR option to increment the score of a member
     *
     * @param parser - The command parser
     * @param key - The sorted set key
     * @param members - Member(s) whose score to increment
     * @param options - Additional options for the increment operation
     * @returns The new score of the member after increment (null if member does not exist with XX option)
     * @see https://redis.io/commands/zadd/
     */
    parseCommand(parser, key, members, options) {
        parser.push('ZADD');
        parser.pushKey(key);
        if (options?.condition) {
            parser.push(options.condition);
        }
        if (options?.comparison) {
            parser.push(options.comparison);
        }
        if (options?.CH) {
            parser.push('CH');
        }
        parser.push('INCR');
        (0, ZADD_1.pushMembers)(parser, members);
    },
    transformReply: generic_transformers_1.transformNullableDoubleReply
};
//# sourceMappingURL=ZADD_INCR.js.map