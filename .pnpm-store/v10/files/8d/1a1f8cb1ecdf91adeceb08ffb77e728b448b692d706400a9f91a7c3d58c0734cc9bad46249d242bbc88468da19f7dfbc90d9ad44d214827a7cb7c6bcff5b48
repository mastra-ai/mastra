"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the MODULE LIST command
     *
     * @param parser - The command parser
     * @see https://redis.io/commands/module-list/
     */
    parseCommand(parser) {
        parser.push('MODULE', 'LIST');
    },
    transformReply: {
        2: (reply) => {
            return reply.map(module => {
                const unwrapped = module;
                return {
                    name: unwrapped[1],
                    ver: unwrapped[3]
                };
            });
        },
        3: undefined
    }
};
//# sourceMappingURL=MODULE_LIST.js.map