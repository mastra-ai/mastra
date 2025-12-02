"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Generates a secure password for ACL users
     * @param parser - The Redis command parser
     * @param bits - Optional number of bits for password entropy
     */
    parseCommand(parser, bits) {
        parser.push('ACL', 'GENPASS');
        if (bits) {
            parser.push(bits.toString());
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=ACL_GENPASS.js.map