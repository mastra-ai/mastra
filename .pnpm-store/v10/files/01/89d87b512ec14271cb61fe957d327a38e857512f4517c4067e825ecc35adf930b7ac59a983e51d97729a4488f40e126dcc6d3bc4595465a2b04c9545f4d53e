"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the LMOVE command
     *
     * @param parser - The command parser
     * @param source - The source list key
     * @param destination - The destination list key
     * @param sourceSide - The side to pop from (LEFT or RIGHT)
     * @param destinationSide - The side to push to (LEFT or RIGHT)
     * @see https://redis.io/commands/lmove/
     */
    parseCommand(parser, source, destination, sourceSide, destinationSide) {
        parser.push('LMOVE');
        parser.pushKeys([source, destination]);
        parser.push(sourceSide, destinationSide);
    },
    transformReply: undefined
};
//# sourceMappingURL=LMOVE.js.map