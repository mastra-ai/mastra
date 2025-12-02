"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushMembers = void 0;
const generic_transformers_1 = require("./generic-transformers");
/**
 * Command for adding members to a sorted set
 */
exports.default = {
    /**
     * Constructs the ZADD command to add one or more members to a sorted set
     *
     * @param parser - The command parser
     * @param key - The sorted set key
     * @param members - One or more members to add with their scores
     * @param options - Additional options for adding members
     * @returns Number of new members added (or changed members if CH is set)
     * @see https://redis.io/commands/zadd/
     */
    parseCommand(parser, key, members, options) {
        parser.push('ZADD');
        parser.pushKey(key);
        if (options?.condition) {
            parser.push(options.condition);
        }
        else if (options?.NX) {
            parser.push('NX');
        }
        else if (options?.XX) {
            parser.push('XX');
        }
        if (options?.comparison) {
            parser.push(options.comparison);
        }
        else if (options?.LT) {
            parser.push('LT');
        }
        else if (options?.GT) {
            parser.push('GT');
        }
        if (options?.CH) {
            parser.push('CH');
        }
        pushMembers(parser, members);
    },
    transformReply: generic_transformers_1.transformDoubleReply
};
/**
 * Helper function to push sorted set members to the command
 *
 * @param parser - The command parser
 * @param members - One or more members with their scores
 */
function pushMembers(parser, members) {
    if (Array.isArray(members)) {
        for (const member of members) {
            pushMember(parser, member);
        }
    }
    else {
        pushMember(parser, members);
    }
}
exports.pushMembers = pushMembers;
/**
 * Helper function to push a single sorted set member to the command
 *
 * @param parser - The command parser
 * @param member - Member with its score
 */
function pushMember(parser, member) {
    parser.push((0, generic_transformers_1.transformDoubleArgument)(member.score), member.value);
}
//# sourceMappingURL=ZADD.js.map