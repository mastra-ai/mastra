"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Pops an element from a list, pushes it to another list and returns it; blocks until element is available
     * @param parser - The Redis command parser
     * @param source - Key of the source list to pop from
     * @param destination - Key of the destination list to push to
     * @param timeout - Maximum seconds to block, 0 to block indefinitely
     */
    parseCommand(parser, source, destination, timeout) {
        parser.push('BRPOPLPUSH');
        parser.pushKeys([source, destination]);
        parser.push(timeout.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=BRPOPLPUSH.js.map