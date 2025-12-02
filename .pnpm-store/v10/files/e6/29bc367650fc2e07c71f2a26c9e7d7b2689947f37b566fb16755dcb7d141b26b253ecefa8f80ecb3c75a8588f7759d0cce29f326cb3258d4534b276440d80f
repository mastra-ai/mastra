"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the SCRIPT EXISTS command
     *
     * @param parser - The command parser
     * @param sha1 - One or more SHA1 digests of scripts
     * @see https://redis.io/commands/script-exists/
     */
    parseCommand(parser, sha1) {
        parser.push('SCRIPT', 'EXISTS');
        parser.pushVariadic(sha1);
    },
    transformReply: undefined
};
//# sourceMappingURL=SCRIPT_EXISTS.js.map