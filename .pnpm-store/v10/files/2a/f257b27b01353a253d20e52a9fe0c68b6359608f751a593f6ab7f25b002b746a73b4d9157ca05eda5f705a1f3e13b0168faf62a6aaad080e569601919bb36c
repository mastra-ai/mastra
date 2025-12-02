"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Pop an element from a list, push it to another list and return it; or block until one is available
     * @param parser - The Redis command parser
     * @param source - Key of the source list
     * @param destination - Key of the destination list
     * @param sourceSide - Side of source list to pop from (LEFT or RIGHT)
     * @param destinationSide - Side of destination list to push to (LEFT or RIGHT)
     * @param timeout - Timeout in seconds, 0 to block indefinitely
     */
    parseCommand(parser, source, destination, sourceSide, destinationSide, timeout) {
        parser.push('BLMOVE');
        parser.pushKeys([source, destination]);
        parser.push(sourceSide, destinationSide, timeout.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=BLMOVE.js.map