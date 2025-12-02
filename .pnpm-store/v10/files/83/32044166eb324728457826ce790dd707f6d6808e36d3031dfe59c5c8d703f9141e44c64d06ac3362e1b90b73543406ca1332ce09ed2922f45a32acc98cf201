"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the INFO command
     *
     * @param parser - The command parser
     * @param section - Optional specific section of information to retrieve
     * @see https://redis.io/commands/info/
     */
    parseCommand(parser, section) {
        parser.push('INFO');
        if (section) {
            parser.push(section);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=INFO.js.map