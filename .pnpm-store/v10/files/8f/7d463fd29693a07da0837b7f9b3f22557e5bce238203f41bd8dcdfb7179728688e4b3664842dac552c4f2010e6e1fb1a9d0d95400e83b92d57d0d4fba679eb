"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the MODULE LOAD command
     *
     * @param parser - The command parser
     * @param path - Path to the module file
     * @param moduleArguments - Optional arguments to pass to the module
     * @see https://redis.io/commands/module-load/
     */
    parseCommand(parser, path, moduleArguments) {
        parser.push('MODULE', 'LOAD', path);
        if (moduleArguments) {
            parser.push(...moduleArguments);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=MODULE_LOAD.js.map