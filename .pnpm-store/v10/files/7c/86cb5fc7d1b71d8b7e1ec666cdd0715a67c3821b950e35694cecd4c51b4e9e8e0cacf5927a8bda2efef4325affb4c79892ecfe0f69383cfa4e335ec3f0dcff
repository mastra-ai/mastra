"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the SMOVE command
     *
     * @param parser - The command parser
     * @param source - The source set key
     * @param destination - The destination set key
     * @param member - The member to move
     * @see https://redis.io/commands/smove/
     */
    parseCommand(parser, source, destination, member) {
        parser.push('SMOVE');
        parser.pushKeys([source, destination]);
        parser.push(member);
    },
    transformReply: undefined
};
//# sourceMappingURL=SMOVE.js.map