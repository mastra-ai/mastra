"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the LOLWUT command
     *
     * @param parser - The command parser
     * @param version - Optional version parameter
     * @param optionalArguments - Additional optional numeric arguments
     * @see https://redis.io/commands/lolwut/
     */
    parseCommand(parser, version, ...optionalArguments) {
        parser.push('LOLWUT');
        if (version) {
            parser.push('VERSION', version.toString());
            parser.pushVariadic(optionalArguments.map(String));
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=LOLWUT.js.map