"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Constructs the RPOPLPUSH command
     *
     * @param parser - The command parser
     * @param source - The source list key
     * @param destination - The destination list key
     * @see https://redis.io/commands/rpoplpush/
     */
    parseCommand(parser, source, destination) {
        parser.push('RPOPLPUSH');
        parser.pushKeys([source, destination]);
    },
    transformReply: undefined
};
//# sourceMappingURL=RPOPLPUSH.js.map