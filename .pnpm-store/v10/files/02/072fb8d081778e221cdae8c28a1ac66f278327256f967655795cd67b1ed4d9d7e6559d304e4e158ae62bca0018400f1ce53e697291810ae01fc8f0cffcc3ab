"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns details about specific Redis commands
     * @param parser - The Redis command parser
     * @param commands - Array of command names to get information about
     */
    parseCommand(parser, commands) {
        parser.push('COMMAND', 'INFO', ...commands);
    },
    // TODO: This works, as we don't currently handle any of the items returned as a map
    transformReply(reply) {
        return reply.map(command => command ? (0, generic_transformers_1.transformCommandReply)(command) : null);
    }
};
//# sourceMappingURL=COMMAND_INFO.js.map